import Stripe from 'stripe';

let client: Stripe | null = null;

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
