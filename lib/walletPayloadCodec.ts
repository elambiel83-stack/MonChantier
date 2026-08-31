import { WalletDepositMethod } from '@/lib/walletStore';
import { WalletCurrency } from '@/lib/walletExchange';

export type WalletDepositPayload = {
  kind: 'wallet_deposit';
  identity: string;
  reference: string;
  method: WalletDepositMethod;
  currency: WalletCurrency;
  amount: number;
};

export function encodeWalletDepositPayload(payload: Omit<WalletDepositPayload, 'kind'>): string {
  return Buffer.from(JSON.stringify({ kind: 'wallet_deposit', ...payload }), 'utf8').toString(
    'base64url'
  );
}

export function decodeWalletDepositPayload(payload: string | null): WalletDepositPayload | null {
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '='
    );
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<WalletDepositPayload>;

    if (parsed.kind !== 'wallet_deposit') return null;
    if (!parsed.identity || !parsed.reference) return null;
    if (parsed.method !== 'card' && parsed.method !== 'paypal' && parsed.method !== 'mobilemoney') {
      return null;
    }
    if (parsed.currency !== 'USD' && parsed.currency !== 'CDF') return null;

    const amount = Number(parsed.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    return {
      kind: 'wallet_deposit',
      identity: parsed.identity,
      reference: parsed.reference,
      method: parsed.method,
      currency: parsed.currency,
      amount,
    };
  } catch {
    return null;
  }
}
