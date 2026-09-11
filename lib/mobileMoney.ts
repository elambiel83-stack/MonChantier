export type MobileMoneyNetwork = 'vodacom' | 'airtel' | 'orange' | 'mpesa';

type MobileMoneyProvider = 'generic' | 'flutterwave';
type MobileMoneyStatus = 'pending' | 'confirmed';
const MOBILE_MONEY_TIMEOUT_MS = 15000;

function getProvider(): MobileMoneyProvider {
  return process.env.MOBILE_MONEY_PROVIDER === 'generic' ? 'generic' : 'flutterwave';
}

function getApiKey() {
  return process.env.MOBILE_MONEY_API_KEY || '';
}

function getApiUrl(provider: MobileMoneyProvider) {
  if (provider === 'generic') {
    return process.env.MOBILE_MONEY_API_URL || '';
  }

  return (
    process.env.MOBILE_MONEY_API_URL ||
    'https://api.flutterwave.com/v3/charges?type=mobile_money_franco'
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readIdentifier(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function normalizeMobileMoneyPhone(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : String(value || '').trim();
  if (!raw) return null;

  const normalized = raw.startsWith('+')
    ? `+${raw.slice(1).replace(/\D+/g, '')}`
    : raw.replace(/\D+/g, '');

  if (!/^\+?\d{8,15}$/.test(normalized)) return null;
  return normalized;
}

function normalizeStatus(value: unknown): MobileMoneyStatus {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (
    status === 'completed' ||
    status === 'confirmed'
  ) {
    return 'confirmed';
  }

  return 'pending';
}

function extractMessage(payload: Record<string, unknown> | null) {
  return (
    readString(payload, 'message') ||
    readString(payload, 'processor_response') ||
    readString(payload, 'display_text') ||
    readString(asRecord(payload?.meta), 'message')
  );
}

function extractSettlementStatus(payload: Record<string, unknown> | null, data: Record<string, unknown> | null) {
  return (
    readString(data, 'payment_status') ||
    readString(data, 'charge_status') ||
    readString(payload, 'payment_status') ||
    readString(payload, 'charge_status')
  );
}

function resolveProviderStatus(
  provider: MobileMoneyProvider,
  payload: Record<string, unknown> | null,
  data: Record<string, unknown> | null
) {
  if (provider === 'generic') {
    return normalizeStatus(
      extractSettlementStatus(payload, data) ||
        readString(data, 'status') ||
        readString(payload, 'status')
    );
  }

  return normalizeStatus(extractSettlementStatus(payload, data));
}

export function isMobileMoneyConfigured() {
  const provider = getProvider();
  const apiKey = getApiKey();
  if (!apiKey) return false;
  return Boolean(getApiUrl(provider));
}

export async function initiateMobileMoneyPayment(args: {
  amount: number;
  currency: string;
  phone: string;
  network: MobileMoneyNetwork;
  reference: string;
  customerName: string;
  customerEmail: string;
  productSummary: string;
  invoicePayload: string;
}) {
  const provider = getProvider();
  const apiKey = getApiKey();
  const apiUrl = getApiUrl(provider);

  if (!apiKey || !apiUrl) {
    throw new Error('Configuration Mobile Money incomplète');
  }

  const requestBody =
    provider === 'generic'
      ? {
          reference: args.reference,
          amount: args.amount,
          currency: args.currency,
          phone: args.phone,
          network: args.network,
          customerName: args.customerName,
          customerEmail: args.customerEmail,
          description: args.productSummary || 'Commande MonChantier',
          invoicePayload: args.invoicePayload,
        }
      : {
          tx_ref: args.reference,
          amount: args.amount,
          currency: args.currency,
          network: args.network,
          phone_number: args.phone,
          email: args.customerEmail,
          fullname: args.customerName,
          meta: {
            invoice_payload: args.invoicePayload,
          },
        };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(MOBILE_MONEY_TIMEOUT_MS),
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('Le prestataire Mobile Money ne répond pas à temps');
    }
    throw error;
  });

  const responseText = await response.text();
  let raw: unknown = null;
  if (responseText) {
    try {
      raw = JSON.parse(responseText) as unknown;
    } catch {
      raw = { message: responseText };
    }
  }
  const payload = asRecord(raw);
  const data = asRecord(payload?.data);

  if (!response.ok) {
    throw new Error(
      extractMessage(data) ||
        extractMessage(payload) ||
        `Mobile Money: échec HTTP ${response.status}`
    );
  }

  return {
    status: resolveProviderStatus(provider, payload, data),
    transactionId:
      readIdentifier(data, 'id') ||
      readString(data, 'flw_ref') ||
      readString(data, 'tx_ref') ||
      readIdentifier(payload, 'id') ||
      args.reference,
    message:
      extractMessage(data) ||
      extractMessage(payload) ||
      "Demande Mobile Money envoyée au prestataire.",
  };
}
