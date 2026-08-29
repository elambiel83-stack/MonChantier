import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { confirmPayment } from '@/lib/paymentConfirmation';
import { decodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import {
  hasProcessedWebhookEvent,
  markWebhookEventProcessed,
} from '@/lib/paymentStore';

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

    if (await hasProcessedWebhookEvent('stripe', eventId)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.type !== 'checkout.session.completed') {
      await markWebhookEventProcessed('stripe', eventId);
      return NextResponse.json({ received: true, ignored: true });
    }

    const session = event.data?.object || {};
    const metadata = (session.metadata || {}) as Record<string, string>;
    const invoicePayload = decodeInvoicePayload(metadata.invoice_payload || null);

    if (!invoicePayload) {
      return NextResponse.json(
        { message: 'invoice_payload absent ou invalide dans metadata Stripe' },
        { status: 400 }
      );
    }

    const result = await confirmPayment(invoicePayload);
    await markWebhookEventProcessed('stripe', eventId);
    return NextResponse.json({ received: true, validated: true, ...result });
  } catch (error) {
    console.error('Erreur webhook Stripe:', error);
    return NextResponse.json(
      { message: 'Erreur traitement webhook Stripe' },
      { status: 500 }
    );
  }
}
