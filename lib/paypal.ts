export function getPayPalBaseUrl() {
  return process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
}

export function isPayPalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const baseUrl = getPayPalBaseUrl();

  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET manquants');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Impossible de récupérer le token PayPal');
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Token PayPal manquant');
  }

  return { token: data.access_token, baseUrl };
}

export async function createPayPalOrder(args: {
  amount: number;
  currency: string;
  productSummary: string;
  returnUrl: string;
  cancelUrl: string;
  customId: string;
}) {
  const { amount, currency, productSummary, returnUrl, cancelUrl, customId } = args;
  const { token, baseUrl } = await getPayPalAccessToken();

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: customId,
          description: productSummary || 'Commande MonChantier',
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        user_action: 'PAY_NOW',
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Impossible de créer la commande PayPal');
  }

  const data = (await response.json()) as {
    id?: string;
    links?: Array<{ rel?: string; href?: string }>;
  };

  const approveLink = data.links?.find((link) => link.rel === 'approve')?.href;
  if (!data.id || !approveLink) {
    throw new Error('Réponse PayPal invalide (id/approve manquant)');
  }

  return { orderId: data.id, approveUrl: approveLink };
}

export async function verifyPayPalWebhookSignature(args: {
  headers: {
    transmissionId: string | null;
    transmissionTime: string | null;
    transmissionSig: string | null;
    certUrl: string | null;
    authAlgo: string | null;
  };
  webhookId: string;
  body: Record<string, unknown>;
}) {
  const { headers, webhookId, body } = args;
  const {
    transmissionId,
    transmissionTime,
    transmissionSig,
    certUrl,
    authAlgo,
  } = headers;

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return false;
  }

  const { token, baseUrl } = await getPayPalAccessToken();

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: body,
    }),
  });

  if (!response.ok) return false;

  const data = (await response.json()) as { verification_status?: string };
  return data.verification_status === 'SUCCESS';
}
