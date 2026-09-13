import { timingSafeEqual, createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  confirmPayment,
  ConfirmPaymentPayload,
} from '@/lib/paymentConfirmation';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { recordSecurityEvent } from '@/lib/securityStore';

function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.ADMIN_API_SECRET;
    const providedSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`admin-payment-confirm:${ip}`, { max: 10, windowMs: 15 * 60 * 1000 });

    if (!rateLimit.allowed) {
      await recordSecurityEvent({
        type: 'manual_payment_denied',
        severity: 'critical',
        identity: 'manual-payment-confirm',
        ip,
        detail: `Rate limit atteint (${Math.ceil(rateLimit.retryAfterMs / 1000)}s)`,
      });
      return NextResponse.json(
        { message: 'Trop de confirmations manuelles. Réessayez plus tard.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    if (!expectedSecret) {
      await recordSecurityEvent({
        type: 'manual_payment_denied',
        severity: 'critical',
        identity: 'manual-payment-confirm',
        ip,
        detail: 'ADMIN_API_SECRET manquant',
      });
      return NextResponse.json({ message: 'ADMIN_API_SECRET manquant' }, { status: 500 });
    }

    if (!safeEqual(providedSecret, expectedSecret)) {
      await recordSecurityEvent({
        type: 'manual_payment_denied',
        severity: 'warning',
        identity: 'manual-payment-confirm',
        ip,
        detail: 'Secret de confirmation invalide',
      });
      return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
    }

    const body = (await request.json()) as ConfirmPaymentPayload;

    const result = await confirmPayment(body);
    await recordSecurityEvent({
      type: 'manual_payment_confirmed',
      severity: 'warning',
      identity: body.reference,
      ip,
      detail: `Confirmation manuelle ${body.method}`,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erreur confirmation paiement:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la confirmation du paiement' },
      { status: 500 }
    );
  }
}
