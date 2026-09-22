import crypto from 'crypto';
import Stripe from 'stripe';

let client: Stripe | null = null;

/** Vérifie le HMAC Stripe et refuse les signatures rejouées après 5 minutes. */
export function verifyStripeSignature(payload: string, signatureHeader: string, secret: string): boolean {
  const chunks = signatureHeader.split(',');
  const timestamp = chunks.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = chunks.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const signatureBuffer = Buffer.from(signature, 'hex');
    return signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  });
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY manquant');
  }
  if (!client) {
    client = new Stripe(secretKey);
  }
  return client;
}

export async function createStripeCheckoutSession(args: {
  amount: number;
  currency: string;
  productSummary: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  invoicePayload: string;
}) {
  const stripe = getClient();
  const { amount, currency, productSummary, successUrl, cancelUrl, customerEmail, invoicePayload } = args;

  // Stripe attend un montant en plus petite unité (ex: centimes). CDF n'a pas
  // de sous-unité usuelle: on envoie le montant entier tel quel dans ce cas.
  const zeroDecimalLike = currency.toUpperCase() === 'CDF';
  const unitAmount = zeroDecimalLike ? Math.round(amount) : Math.round(amount * 100);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: unitAmount,
          product_data: { name: productSummary || 'Commande MonChantier' },
        },
        quantity: 1,
      },
    ],
    customer_email: customerEmail || undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { invoice_payload: invoicePayload },
  });

  if (!session.url) {
    throw new Error('Stripe: URL de session absente');
  }

  return { sessionId: session.id, url: session.url };
}

/**
 * Abonnement récurrent (Stripe Billing) pour la facturation SaaS d'un
 * tenant — distinct de createStripeCheckoutSession ci-dessus (paiement
 * ponctuel d'une commande client). Le prix référencé (`priceId`) doit être
 * un Price Stripe pré-créé (mode "subscription" ne supporte pas price_data
 * ad-hoc pour un prix récurrent réutilisable).
 */
export async function createSubscriptionCheckoutSession(args: {
  priceId: string;
  tenantId: string;
  plan: string;
  customerEmail?: string;
  existingCustomerId?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: args.priceId, quantity: 1 }],
    customer: args.existingCustomerId,
    customer_email: args.existingCustomerId ? undefined : args.customerEmail,
    client_reference_id: args.tenantId,
    metadata: { tenantId: args.tenantId, plan: args.plan },
    subscription_data: { metadata: { tenantId: args.tenantId, plan: args.plan } },
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  });

  if (!session.url) {
    throw new Error('Stripe: URL de session absente');
  }

  return { url: session.url };
}
