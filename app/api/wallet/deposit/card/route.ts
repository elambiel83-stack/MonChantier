import { NextRequest, NextResponse } from 'next/server';
import { getWalletIdentity } from '@/lib/walletAuth';
import { registerPendingDeposit } from '@/lib/walletStore';
import { createStripeCheckoutSession, isStripeConfigured } from '@/lib/stripe';
import { encodeWalletDepositPayload } from '@/lib/walletPayloadCodec';
import { WalletCurrency } from '@/lib/walletExchange';

function parsePositiveAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function sanitizeCurrency(value: unknown): WalletCurrency {
  return value === 'USD' ? 'USD' : 'CDF';
}

export async function POST(request: NextRequest) {
  try {
    const identity = await getWalletIdentity();
    if (!identity) {
      return NextResponse.json({ message: 'Connexion avec email requise' }, { status: 401 });
    }

    const body = await request.json();
    const parsedAmount = parsePositiveAmount(body?.amount);
    const currency = sanitizeCurrency(body?.currency);
    const successUrl = String(body?.successUrl || '');
    const cancelUrl = String(body?.cancelUrl || '');

    if (!parsedAmount || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { message: 'Montant et URLs de redirection requis' },
        { status: 400 }
      );
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { message: 'Recharge carte indisponible: STRIPE_SECRET_KEY manquant.' },
        { status: 503 }
      );
    }

    const reference = `WALLET-CARD-${Date.now()}`;
    const walletPayload = encodeWalletDepositPayload({
      identity,
      reference,
      method: 'card',
      currency,
      amount: parsedAmount,
    });

    const session = await createStripeCheckoutSession({
      amount: parsedAmount,
      currency,
      productSummary: 'Recharge porte-monnaie MonChantier',
      successUrl: `${successUrl}?wallet_reference=${encodeURIComponent(reference)}`,
      cancelUrl,
      customerEmail: identity,
      invoicePayload: walletPayload,
    });

    await registerPendingDeposit({
      identity,
      reference,
      method: 'card',
      currency,
      amount: parsedAmount,
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      reference,
    });
  } catch (error) {
    console.error('Erreur recharge carte:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la recharge du porte-monnaie' },
      { status: 500 }
    );
  }
}
