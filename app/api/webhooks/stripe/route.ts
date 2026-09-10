import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { confirmPayment } from '@/lib/paymentConfirmation';
import { decodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import { decodeWalletDepositPayload } from '@/lib/walletPayloadCodec';
import { confirmDeposit } from '@/lib/walletStore';
import { claimWebhookEvent, unclaimWebhookEvent } from '@/lib/paymentStore';

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const chunks = signatureHeader.split(',');
  const timestamp = chunks.find((part) => part.startsWith('t='))?.slice(2);
  const signature = chunks.find((part) => part.startsWith('v1='))?.slice(3);

  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  if (!/^[a-f0-9]+$/i.test(signature)) return false;

  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== signatureBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = request.headers.get('stripe-signature') || '';

    if (!stripeSecret) {
      return NextResponse.json(
        { message: 'STRIPE_WEBHOOK_SECRET manquant' },
        { status: 500 }
      );
    }

    const rawBody = await request.text();
    if (!verifyStripeSignature(rawBody, signature, stripeSecret)) {
      return NextResponse.json({ message: 'Signature Stripe invalide' }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as {
      id?: string;
      type?: string;
      data?: { object?: Record<string, unknown> };
    };

    const eventId = event.id;
    if (!eventId) {
      return NextResponse.json(
        { message: 'Event Stripe sans identifiant' },
        { status: 400 }
      );
    }

    // Claim atomique avant traitement : deux redélivrances concurrentes du
    // même event_id (Stripe le fait réellement) ne peuvent pas toutes les
    // deux passer ce test, contrairement à un has()-puis-mark() en deux temps.
    const claimed = await claimWebhookEvent('stripe', eventId);
    if (!claimed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    try {
      if (event.type !== 'checkout.session.completed') {
        return NextResponse.json({ received: true, ignored: true });
      }

      const session = event.data?.object || {};
      const metadata = (session.metadata || {}) as Record<string, string>;
      const rawPayload = metadata.invoice_payload || null;

      const walletPayload = decodeWalletDepositPayload(rawPayload);
      if (walletPayload) {
        const { wallet, alreadyConfirmed } = await confirmDeposit({
          identity: walletPayload.identity,
          reference: walletPayload.reference,
          method: walletPayload.method,
          currency: walletPayload.currency,
          amount: walletPayload.amount,
        });
        return NextResponse.json({ received: true, validated: true, wallet, alreadyConfirmed });
      }

      const invoicePayload = decodeInvoicePayload(rawPayload);
      if (!invoicePayload) {
        await unclaimWebhookEvent('stripe', eventId);
        return NextResponse.json(
          { message: 'invoice_payload absent ou invalide dans metadata Stripe' },
          { status: 400 }
        );
      }

      const result = await confirmPayment(invoicePayload);
      return NextResponse.json({ received: true, validated: true, ...result });
    } catch (error) {
      // Laisse Stripe retenter cet event_id: un échec de traitement ne doit
      // pas le perdre silencieusement pour toujours.
      await unclaimWebhookEvent('stripe', eventId);
      throw error;
    }
  } catch (error) {
    console.error('Erreur webhook Stripe:', error);
    return NextResponse.json(
      { message: 'Erreur traitement webhook Stripe' },
      { status: 500 }
    );
  }
}
