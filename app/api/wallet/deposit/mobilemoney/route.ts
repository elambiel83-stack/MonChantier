import { NextRequest, NextResponse } from 'next/server';
import { getWalletIdentity } from '@/lib/walletAuth';
import {
  initiateMobileMoneyPayment,
  isMobileMoneyConfigured,
  MobileMoneyNetwork,
  normalizeMobileMoneyPhone,
} from '@/lib/mobileMoney';
import { confirmDeposit, registerPendingDeposit } from '@/lib/walletStore';
import { encodeWalletDepositPayload } from '@/lib/walletPayloadCodec';
import { WalletCurrency } from '@/lib/walletExchange';

function parsePositiveAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function sanitizeCurrency(value: unknown): WalletCurrency {
  return value === 'USD' ? 'USD' : 'CDF';
}

function sanitizeNetwork(value: unknown): MobileMoneyNetwork | null {
  return value === 'vodacom' || value === 'airtel' || value === 'orange' || value === 'mpesa'
    ? value
    : null;
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
    const phone = normalizeMobileMoneyPhone(body?.phone);
    const network = sanitizeNetwork(body?.network);

    if (!parsedAmount || !phone || !network) {
      return NextResponse.json(
        { message: 'Montant, numéro de téléphone et réseau valides requis' },
        { status: 400 }
      );
    }

    if (!isMobileMoneyConfigured()) {
      return NextResponse.json(
        { message: 'Recharge Mobile Money indisponible: configuration prestataire manquante.' },
        { status: 503 }
      );
    }

    const reference = `WALLET-MM-${Date.now()}`;
    const providerResponse = await initiateMobileMoneyPayment({
      amount: parsedAmount,
      currency,
      phone,
      network,
      reference,
      customerName: identity,
      customerEmail: identity,
      productSummary: 'Recharge porte-monnaie MonChantier',
      invoicePayload: encodeWalletDepositPayload({
        identity,
        reference,
        method: 'mobilemoney',
        currency,
        amount: parsedAmount,
      }),
    });

    await registerPendingDeposit({
      identity,
      reference,
      method: 'mobilemoney',
      currency,
      amount: parsedAmount,
    });

    if (providerResponse.status === 'confirmed') {
      const { wallet } = await confirmDeposit({
        identity,
        reference,
        method: 'mobilemoney',
        currency,
        amount: parsedAmount,
      });
      return NextResponse.json({ success: true, status: 'confirmed', reference, wallet });
    }

    return NextResponse.json({
      success: true,
      status: 'pending',
      reference,
      message:
        providerResponse.message ||
        `Demande envoyée à ${phone}. Veuillez confirmer sur votre téléphone.`,
    });
  } catch (error) {
    console.error('Erreur recharge Mobile Money:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la recharge du porte-monnaie' },
      { status: 500 }
    );
  }
}
