import { NextRequest, NextResponse } from 'next/server';
import { getWalletIdentity } from '@/lib/walletAuth';
import { normalizeMobileMoneyPhone } from '@/lib/mobileMoney';
import { confirmDeposit } from '@/lib/walletStore';
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
    const phone = normalizeMobileMoneyPhone(body?.phone);

    if (!parsedAmount || !phone) {
      return NextResponse.json(
        { message: 'Montant et numéro de téléphone valides requis' },
        { status: 400 }
      );
    }

    // Simulation, cohérente avec le reste du parcours Mobile Money de l'app.
    await new Promise((resolve) => setTimeout(resolve, 800));

    const reference = `WALLET-MM-${Date.now()}`;
    const { wallet } = await confirmDeposit({
      identity,
      reference,
      method: 'mobilemoney',
      currency,
      amount: parsedAmount,
    });

    return NextResponse.json({ success: true, reference, wallet });
  } catch (error) {
    console.error('Erreur recharge Mobile Money:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la recharge du porte-monnaie' },
      { status: 500 }
    );
  }
}
