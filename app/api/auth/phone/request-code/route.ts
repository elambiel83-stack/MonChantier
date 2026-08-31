import { NextResponse } from "next/server";
import { createPhoneOtp } from "@/lib/phoneAuth";
import { isSmsConfigured, sendSms } from "@/lib/sms";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

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
      return NextResponse.json(
        { message: `Trop de demandes. Réessayez dans ${retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const { code, expiresAt, phone: normalizedPhone } = await createPhoneOtp(phone);

    let smsSent = false;
    let smsError: string | null = null;

    if (isSmsConfigured()) {
      try {
        await sendSms({
          to: normalizedPhone,
          message: `MonChantier: votre code de connexion est ${code}. Il expire dans 5 minutes.`,
        });
        smsSent = true;
      } catch (error) {
        smsError = error instanceof Error ? error.message : "Échec envoi SMS";
        console.error("Erreur envoi SMS OTP:", error);
      }
    }

    const devMode = process.env.NODE_ENV === "development";

    return NextResponse.json({
      ok: true,
      phone: normalizedPhone,
      expiresAt,
      devCode: devMode ? code : undefined,
      message: smsSent
        ? "Code OTP envoyé par SMS"
        : devMode
          ? `Code OTP généré (dev): ${code}`
          : smsError
            ? "Envoi du SMS impossible pour le moment. Réessayez."
            : "SMS non configuré côté serveur.",
    });
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
}
