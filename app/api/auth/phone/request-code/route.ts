import { NextResponse } from "next/server";
import { createPhoneOtp, normalizePhone } from "@/lib/phoneAuth";
import { isSmsConfigured, sendSms } from "@/lib/sms";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { isWhatsAppOtpConfigured, sendWhatsAppOtp } from '@/lib/whatsappOtp';

type DeliveryChannel = 'sms' | 'whatsapp';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = (body?.phone || "").toString();
    const channel: DeliveryChannel = body?.channel === 'whatsapp' ? 'whatsapp' : 'sms';

    const validatedPhone = normalizePhone(phone);
    if (!validatedPhone) {
      return NextResponse.json({ message: "Numéro invalide. Utilisez le format international +243..." }, { status: 400 });
    }

    const ip = getClientIp(req);
    const byPhone = await checkRateLimit(`otp-request:phone:${validatedPhone}`, { max: 3, windowMs: 10 * 60 * 1000 });
    const byIp = await checkRateLimit(`otp-request:ip:${ip}`, { max: 10, windowMs: 10 * 60 * 1000 });
    if (!byPhone.allowed || !byIp.allowed) {
      const retryAfterSec = Math.ceil(Math.max(byPhone.retryAfterMs, byIp.retryAfterMs) / 1000);
      return NextResponse.json(
        { message: `Trop de demandes. Réessayez dans ${retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const captchaOk = await verifyTurnstileToken(body?.turnstileToken, ip);
    if (!captchaOk) {
      return NextResponse.json({ message: "Vérification anti-robot invalide." }, { status: 400 });
    }

    const { code, expiresAt, phone: normalizedPhone } = await createPhoneOtp(phone);

    let sent = false;
    let deliveryError: string | null = null;

    if (channel === 'sms' && isSmsConfigured()) {
      try {
        await sendSms({
          to: normalizedPhone,
          message: `MonChantier: votre code de connexion est ${code}. Il expire dans 5 minutes.`,
        });
        sent = true;
      } catch (error) {
        deliveryError = error instanceof Error ? error.message : "Échec envoi SMS";
        console.error("Erreur envoi SMS OTP:", error);
      }
    }
    if (channel === 'whatsapp' && isWhatsAppOtpConfigured()) {
      try {
        await sendWhatsAppOtp({ to: normalizedPhone, code });
        sent = true;
      } catch (error) {
        deliveryError = error instanceof Error ? error.message : 'Échec envoi WhatsApp';
        console.error('Erreur envoi WhatsApp OTP:', error);
      }
    }

    const devMode = process.env.NODE_ENV === "development";

    if (!sent && !devMode) {
      return NextResponse.json(
        { message: deliveryError ? 'Envoi du code impossible pour le moment. Réessayez.' : `${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} non configuré côté serveur.` },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      phone: normalizedPhone,
      expiresAt,
      devCode: devMode ? code : undefined,
      channel,
      message: sent
        ? channel === 'whatsapp' ? 'Code OTP envoyé sur WhatsApp' : "Code OTP envoyé par SMS"
        : devMode
          ? `Code OTP généré (dev): ${code}`
          : deliveryError
            ? `Envoi ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} impossible pour le moment. Réessayez.`
            : `${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} non configuré côté serveur.`,
    });
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
}
