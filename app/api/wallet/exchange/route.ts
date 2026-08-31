import { NextRequest, NextResponse } from 'next/server';
import { getWalletIdentity } from '@/lib/walletAuth';
import { applyExchange } from '@/lib/walletStore';
import { quoteExchange, WalletCurrency } from '@/lib/walletExchange';

function isCurrency(value: unknown): value is WalletCurrency {
  return value === 'USD' || value === 'CDF';
}

export async function POST(request: NextRequest) {
  try {
    const identity = await getWalletIdentity();
    if (!identity) {
      return NextResponse.json({ message: 'Connexion avec email requise' }, { status: 401 });
    }

    const body = await request.json();
    const from = body?.from;
    const to = body?.to;
    const amount = Number(body?.amount);

    if (!isCurrency(from) || !isCurrency(to) || from === to || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ message: 'Paramètres de change invalides' }, { status: 400 });
    }

    const quote = quoteExchange(from, to, amount);

    const result = await applyExchange({
      identity,
      fromCurrency: from,
      fromAmount: amount,
      toCurrency: to,
      toAmount: quote.convertedAmount,
      bccRate: quote.bccRate,
      appliedRate: quote.appliedRate,
      marginPercent: quote.marginPercent,
    });

    if (!result.success) {
      return NextResponse.json({ message: 'Solde insuffisant pour cette opération de change' }, { status: 400 });
    }

    return NextResponse.json({ success: true, wallet: result.wallet, transaction: result.transaction, quote });
  } catch (error) {
    console.error('Erreur change porte-monnaie:', error);
    return NextResponse.json({ message: 'Erreur lors de l\'opération de change' }, { status: 500 });
  }
}
