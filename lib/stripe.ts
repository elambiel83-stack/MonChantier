import crypto from 'crypto';
import Stripe from 'stripe';

let client: Stripe | null = null;

/** Vérification manuelle de signature webhook Stripe (HMAC-SHA256, tolère un léger décalage d'horloge implicite via le timestamp signé). */
export function verifyStripeSignature(payload: string, signatureHeader: string, secret: string): boolean {
  const chunks = signatureHeader.split(',');
  const timestamp = chunks.find((part) => part.startsWith('t='))?.slice(2);
  const signature = chunks.find((part) => part.startsWith('v1='))?.slice(3);

  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  if (!/^[a-f0-9]+$/i.test(signature)) return false;

  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== signatureBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
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
