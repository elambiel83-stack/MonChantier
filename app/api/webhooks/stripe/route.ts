import { NextRequest, NextResponse } from 'next/server';
import { confirmPayment, ConfirmPaymentPayload } from '@/lib/paymentConfirmation';
import { decodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import { decodeWalletDepositPayload } from '@/lib/walletPayloadCodec';
import { confirmDeposit } from '@/lib/walletStore';
import { claimWebhookEvent, getStoredPaymentStatus, unclaimWebhookEvent } from '@/lib/paymentStore';
import { verifyStripeSignature } from '@/lib/stripe';

function stripeAmount(amountTotal: unknown, currency: string): number | null {
  const raw = Number(amountTotal);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return currency === 'CDF' ? raw : raw / 100;
}

function sameMoney(actual: number, expected: number) {
  return Math.round(actual * 100) === Math.round(expected * 100);
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = request.headers.get('stripe-signature') || '';
    if (!secret) return NextResponse.json({ message: 'STRIPE_WEBHOOK_SECRET manquant' }, { status: 500 });

    const rawBody = await request.text();
    if (!verifyStripeSignature(rawBody, signature, secret)) {
      return NextResponse.json({ message: 'Signature Stripe invalide' }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
    if (!event.id) return NextResponse.json({ message: 'Event Stripe sans identifiant' }, { status: 400 });

    const claimed = await claimWebhookEvent('stripe', event.id);
    if (!claimed) return NextResponse.json({ received: true, duplicate: true });

    try {
      if (event.type !== 'checkout.session.completed') {
        return NextResponse.json({ received: true, ignored: true });
      }

      const session = event.data?.object || {};
      if (session.payment_status !== 'paid') {
        await unclaimWebhookEvent('stripe', event.id);
        return NextResponse.json({ message: 'Session Stripe non payée' }, { status: 409 });
      }

      const metadata = (session.metadata || {}) as Record<string, string>;
      const rawPayload = metadata.invoice_payload || null;
      const currency = String(session.currency || '').toUpperCase();
      const paidAmount = stripeAmount(session.amount_total, currency);
      if (!paidAmount) {
        await unclaimWebhookEvent('stripe', event.id);
        return NextResponse.json({ message: 'Montant Stripe absent ou invalide' }, { status: 400 });
      }

      const walletPayload = decodeWalletDepositPayload(rawPayload);
      if (walletPayload) {
        if (walletPayload.currency.toUpperCase() !== currency || !sameMoney(paidAmount, walletPayload.amount)) {
          await unclaimWebhookEvent('stripe', event.id);
          return NextResponse.json({ message: 'Montant Stripe incohérent' }, { status: 409 });
        }
        const result = await confirmDeposit({
          identity: walletPayload.identity, reference: walletPayload.reference,
          method: walletPayload.method, currency: walletPayload.currency, amount: walletPayload.amount,
        });
        return NextResponse.json({ received: true, validated: true, ...result });
      }

      const decoded = decodeInvoicePayload(rawPayload);
      if (!decoded) {
        await unclaimWebhookEvent('stripe', event.id);
        return NextResponse.json({ message: 'invoice_payload absent ou invalide' }, { status: 400 });
      }
      const stored = await getStoredPaymentStatus(decoded.reference);
      const pending = stored?.pendingPayload as unknown as ConfirmPaymentPayload | undefined;
      if (!stored || stored.method !== 'card' || !pending) {
        await unclaimWebhookEvent('stripe', event.id);
        return NextResponse.json({ message: 'Commande Stripe inconnue' }, { status: 404 });
      }
      if (String(pending.currency).toUpperCase() !== currency || !sameMoney(paidAmount, Number(pending.amount))) {
        await unclaimWebhookEvent('stripe', event.id);
        return NextResponse.json({ message: 'Montant Stripe incohérent' }, { status: 409 });
      }

      const result = await confirmPayment(pending);
      return NextResponse.json({ received: true, validated: true, ...result });
    } catch (error) {
      await unclaimWebhookEvent('stripe', event.id);
      throw error;
    }
  } catch (error) {
    console.error('Erreur webhook Stripe:', error);
    return NextResponse.json({ message: 'Erreur traitement webhook Stripe' }, { status: 500 });
  }
}
