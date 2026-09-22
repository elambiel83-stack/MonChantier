import { NextRequest, NextResponse } from 'next/server';
import { confirmPayment, ConfirmPaymentPayload } from '@/lib/paymentConfirmation';
import { decodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import { decodeWalletDepositPayload } from '@/lib/walletPayloadCodec';
import { confirmDeposit } from '@/lib/walletStore';
import { verifyPayPalWebhookSignature } from '@/lib/paypal';
import { claimWebhookEvent, getStoredPaymentStatus, unclaimWebhookEvent } from '@/lib/paymentStore';

function sameMoney(actual: number, expected: number) {
  return Number.isFinite(actual) && Math.round(actual * 100) === Math.round(expected * 100);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const eventType = String(body.event_type || '');
    const eventId = typeof body.id === 'string' ? body.id : null;
    if (!eventId) return NextResponse.json({ message: 'Event PayPal sans identifiant' }, { status: 400 });

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) return NextResponse.json({ message: 'PAYPAL_WEBHOOK_ID manquant' }, { status: 500 });

    const valid = await verifyPayPalWebhookSignature({
      webhookId, body,
      headers: {
        transmissionId: request.headers.get('paypal-transmission-id'),
        transmissionTime: request.headers.get('paypal-transmission-time'),
        transmissionSig: request.headers.get('paypal-transmission-sig'),
        certUrl: request.headers.get('paypal-cert-url'),
        authAlgo: request.headers.get('paypal-auth-algo'),
      },
    });
    if (!valid) return NextResponse.json({ message: 'Signature PayPal invalide' }, { status: 400 });

    const claimed = await claimWebhookEvent('paypal', eventId);
    if (!claimed) return NextResponse.json({ received: true, duplicate: true });

    try {
      // ORDER.APPROVED n'est pas une preuve d'encaissement.
      if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
        return NextResponse.json({ received: true, ignored: true });
      }

      const resource = (body.resource || {}) as Record<string, unknown>;
      if (String(resource.status || '') !== 'COMPLETED') {
        await unclaimWebhookEvent('paypal', eventId);
        return NextResponse.json({ message: 'Capture PayPal non terminée' }, { status: 409 });
      }

      const amount = (resource.amount || {}) as Record<string, unknown>;
      const paidAmount = Number(amount.value);
      const currency = String(amount.currency_code || '').toUpperCase();
      const customId = typeof resource.custom_id === 'string' ? resource.custom_id : null;
      if (!Number.isFinite(paidAmount) || paidAmount <= 0 || !currency || !customId) {
        await unclaimWebhookEvent('paypal', eventId);
        return NextResponse.json({ message: 'Capture PayPal incomplète' }, { status: 400 });
      }

      const walletPayload = decodeWalletDepositPayload(customId);
      if (walletPayload) {
        if (walletPayload.currency.toUpperCase() !== currency || !sameMoney(paidAmount, walletPayload.amount)) {
          await unclaimWebhookEvent('paypal', eventId);
          return NextResponse.json({ message: 'Montant PayPal incohérent' }, { status: 409 });
        }
        const result = await confirmDeposit({
          identity: walletPayload.identity, reference: walletPayload.reference,
          method: walletPayload.method, currency: walletPayload.currency, amount: walletPayload.amount,
        });
        return NextResponse.json({ received: true, validated: true, ...result });
      }

      const decoded = decodeInvoicePayload(customId);
      if (!decoded) {
        await unclaimWebhookEvent('paypal', eventId);
        return NextResponse.json({ message: 'custom_id PayPal invalide' }, { status: 400 });
      }
      const stored = await getStoredPaymentStatus(decoded.reference);
      const pending = stored?.pendingPayload as unknown as ConfirmPaymentPayload | undefined;
      if (!stored || stored.method !== 'paypal' || !pending) {
        await unclaimWebhookEvent('paypal', eventId);
        return NextResponse.json({ message: 'Commande PayPal inconnue' }, { status: 404 });
      }
      if (String(pending.currency).toUpperCase() !== currency || !sameMoney(paidAmount, Number(pending.amount))) {
        await unclaimWebhookEvent('paypal', eventId);
        return NextResponse.json({ message: 'Montant PayPal incohérent' }, { status: 409 });
      }

      const result = await confirmPayment(pending);
      return NextResponse.json({ received: true, validated: true, ...result });
    } catch (error) {
      await unclaimWebhookEvent('paypal', eventId);
      throw error;
    }
  } catch (error) {
    console.error('Erreur webhook PayPal:', error);
    return NextResponse.json({ message: 'Erreur traitement webhook PayPal' }, { status: 500 });
  }
}
