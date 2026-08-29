import { ConfirmPaymentPayload, isSupportedMethod } from '@/lib/paymentConfirmation';

export function encodeInvoicePayload(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeInvoicePayload(payload: string | null) {
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '='
    );
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<ConfirmPaymentPayload>;

    if (!parsed.reference || !isSupportedMethod(parsed.method) || Number(parsed.amount) <= 0) {
      return null;
    }

    return {
      reference: parsed.reference,
      method: parsed.method,
      amount: Number(parsed.amount),
      currency: parsed.currency,
      customerName: parsed.customerName,
      customerEmail: parsed.customerEmail,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      deliveryAddress: parsed.deliveryAddress,
      location: parsed.location,
    } as ConfirmPaymentPayload;
  } catch {
    return null;
  }
}
