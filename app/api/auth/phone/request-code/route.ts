import { NextResponse } from "next/server";
import { createPhoneOtp, revokePhoneOtp } from "@/lib/phoneAuth";
import { isSmsConfigured, sendSms } from "@/lib/sms";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { recordSecurityEvent } from "@/lib/securityStore";

function isLocalHost(host: string | null) {
  if (!host) return false;
  const normalized = host.trim().toLowerCase().split(":")[0];
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]";
}

function canExposeDebugOtp(req: Request) {
  if (process.env.ALLOW_OTP_DEBUG_CODE !== "true" || process.env.NODE_ENV !== "development") {
    return false;
  }

  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost || (forwardedProto && forwardedProto !== "http")) {
    return false;
  }

  return isLocalHost(req.headers.get("host"));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = (body?.phone || "").toString();

    if (!phone) {
      return NextResponse.json({ message: "Phone number is required" }, { status: 400 });
    }

    const ip = getClientIp(req);
    const byPhone = checkRateLimit(`otp-request:phone:${phone.trim()}`, { max: 3, windowMs: 10 * 60 * 1000 });
    const byIp = checkRateLimit(`otp-request:ip:${ip}`, { max: 10, windowMs: 10 * 60 * 1000 });
    if (!byPhone.allowed || !byIp.allowed) {
      const retryAfterSec = Math.ceil(Math.max(byPhone.retryAfterMs, byIp.retryAfterMs) / 1000);
      await recordSecurityEvent({
        type: "otp_request_rate_limited",
        severity: "warning",
        identity: phone,
        ip,
        detail: `Retry in ${retryAfterSec}s`,
      });
      return NextResponse.json(
        { message: `Trop de demandes. Réessayez dans ${retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const debugExposureAllowed = canExposeDebugOtp(req);
    const smsConfigured = isSmsConfigured();
    if (!smsConfigured && !debugExposureAllowed) {
      await recordSecurityEvent({
        type: "otp_requested",
        severity: "warning",
        identity: phone,
        ip,
        detail: "OTP refusé: transport SMS indisponible sur environnement exposé",
      });
      return NextResponse.json(
        { message: "Service OTP indisponible: configuration SMS requise." },
        { status: 503 }
      );
    }

    const { code, expiresAt, phone: normalizedPhone } = await createPhoneOtp(phone);

    let smsSent = false;
    let smsError: string | null = null;

    if (smsConfigured) {
      try {
        await sendSms({
          to: normalizedPhone,
          message: `MonChantier: votre code de connexion est ${code}. Il expire dans 5 minutes.`,
        });
        smsSent = true;
      } catch (error) {
        smsError = error instanceof Error ? error.message : "Échec envoi SMS";
        console.error("Erreur envoi SMS OTP:", error);
        await revokePhoneOtp(normalizedPhone);
      }
    }

    await recordSecurityEvent({
      type: "otp_requested",
      severity: smsSent ? "info" : "warning",
      identity: normalizedPhone,
      ip,
      detail: smsSent ? "OTP envoyé par SMS" : "OTP généré sans confirmation SMS",
    });

    if (!smsSent && !debugExposureAllowed) {
      return NextResponse.json(
        { message: smsError || "Envoi du SMS impossible pour le moment. Réessayez." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      phone: normalizedPhone,
      expiresAt,
      devCode: debugExposureAllowed ? code : undefined,
      message: smsSent
        ? "Code OTP envoyé par SMS"
        : debugExposureAllowed
          ? `Code OTP généré (dev): ${code}`
          : smsError
            ? "Envoi du SMS impossible pour le moment. Réessayez."
            : "SMS non configuré côté serveur.",
    });
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
}
