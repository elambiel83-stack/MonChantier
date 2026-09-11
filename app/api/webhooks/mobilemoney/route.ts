import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { confirmPayment } from '@/lib/paymentConfirmation';
import { decodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import { decodeWalletDepositPayload } from '@/lib/walletPayloadCodec';
import { confirmDeposit } from '@/lib/walletStore';
import {
  hasProcessedWebhookEvent,
  markWebhookEventProcessed,
} from '@/lib/paymentStore';

function safeEqual(a: string, b: string) {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
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

function resolveEventId(body: Record<string, unknown>, data: Record<string, unknown> | null) {
  return (
    readString(body, 'eventId') ||
    readString(body, 'id') ||
    readString(data, 'eventId') ||
    readString(data, 'id') ||
    readString(data, 'flw_ref') ||
    readString(data, 'tx_ref') ||
    readString(body, 'reference')
  );
}

function isConfirmed(body: Record<string, unknown>, data: Record<string, unknown> | null) {
  const value =
    readString(data, 'payment_status') ||
    readString(data, 'charge_status') ||
    readString(body, 'payment_status') ||
    readString(body, 'charge_status') ||
    readString(data, 'status') ||
    readString(body, 'status') ||
    '';
  return ['completed', 'confirmed', 'successful', 'success'].includes(value.toLowerCase());
}

function extractPayload(body: Record<string, unknown>, data: Record<string, unknown> | null) {
  const bodyMeta = asRecord(body.meta);
  const dataMeta = asRecord(data?.meta);
  return (
    readString(data, 'invoicePayload') ||
    readString(body, 'invoicePayload') ||
    readString(dataMeta, 'invoice_payload') ||
    readString(bodyMeta, 'invoice_payload')
  );
}

function extractSecret(request: NextRequest) {
  return (
    request.headers.get('verif-hash') ||
    request.headers.get('x-mobilemoney-signature') ||
    request.headers.get('x-webhook-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    ''
  );
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.MOBILE_MONEY_WEBHOOK_SECRET;
    const providedSecret = extractSecret(request);

    if (!expectedSecret || !providedSecret || !safeEqual(providedSecret, expectedSecret)) {
      return NextResponse.json({ message: 'Webhook Mobile Money non autorisé' }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const data = asRecord(body.data);
    const eventId = resolveEventId(body, data);
    if (!eventId) {
      return NextResponse.json({ message: 'Événement Mobile Money sans identifiant' }, { status: 400 });
    }

    if (await hasProcessedWebhookEvent('mobilemoney', eventId)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (!isConfirmed(body, data)) {
      await markWebhookEventProcessed('mobilemoney', eventId);
      return NextResponse.json({ received: true, ignored: true });
    }

    const encodedPayload = extractPayload(body, data);
    const walletPayload = decodeWalletDepositPayload(encodedPayload);
    if (walletPayload) {
      const { wallet, alreadyConfirmed } = await confirmDeposit({
        identity: walletPayload.identity,
        reference: walletPayload.reference,
        method: walletPayload.method,
        currency: walletPayload.currency,
        amount: walletPayload.amount,
      });
      await markWebhookEventProcessed('mobilemoney', eventId);
      return NextResponse.json({ received: true, validated: true, wallet, alreadyConfirmed });
    }

    const invoicePayload = decodeInvoicePayload(encodedPayload);
    if (!invoicePayload) {
      return NextResponse.json(
        { message: 'invoice_payload absent ou invalide dans le webhook Mobile Money' },
        { status: 400 }
      );
    }

    const result = await confirmPayment(invoicePayload);
    await markWebhookEventProcessed('mobilemoney', eventId);
    return NextResponse.json({ received: true, validated: true, ...result });
  } catch (error) {
    console.error('Erreur webhook Mobile Money:', error);
    return NextResponse.json(
      { message: 'Erreur traitement webhook Mobile Money' },
      { status: 500 }
    );
  }
}
