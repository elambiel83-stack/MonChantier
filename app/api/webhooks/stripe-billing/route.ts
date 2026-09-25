import { NextRequest, NextResponse } from 'next/server';
import { verifyStripeSignature } from '@/lib/stripe';
import { applyStripeBillingEvent, claimBillingWebhookEvent, unclaimBillingWebhookEvent } from '@/lib/tenantBilling';

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

/**
 * Endpoint Stripe séparé de /api/webhooks/stripe (paiements ponctuels de
 * commandes) : les abonnements SaaS des tenants sont un flux Stripe
 * distinct, à déclarer comme un deuxième webhook endpoint côté Stripe
 * Dashboard, avec son propre secret de signature.
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
    const signature = request.headers.get('stripe-signature') || '';

    if (!webhookSecret) {
      return NextResponse.json({ message: 'STRIPE_BILLING_WEBHOOK_SECRET manquant' }, { status: 500 });
    }

    const rawBody = await request.text();
    if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ message: 'Signature Stripe invalide' }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as {
      id?: string;
      type?: string;
      data?: { object?: Record<string, unknown> };
    };

    const eventId = event.id;
    if (!eventId) {
      return NextResponse.json({ message: 'Event Stripe sans identifiant' }, { status: 400 });
    }

    const claimed = await claimBillingWebhookEvent(eventId);
    if (!claimed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    try {
      if (!event.type || !HANDLED_EVENTS.has(event.type) || !event.data?.object) {
        return NextResponse.json({ received: true, ignored: true });
      }

      await applyStripeBillingEvent({ type: event.type, data: { object: event.data.object } });
      return NextResponse.json({ received: true, applied: true });
    } catch (error) {
      await unclaimBillingWebhookEvent(eventId);
      throw error;
    }
  } catch (error) {
    console.error('Erreur webhook Stripe Billing:', error);
    return NextResponse.json({ message: 'Erreur traitement webhook Stripe Billing' }, { status: 500 });
  }
}
