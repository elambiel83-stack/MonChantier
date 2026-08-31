import { NextRequest, NextResponse } from 'next/server';
import { quoteExchange, WalletCurrency } from '@/lib/walletExchange';

function isCurrency(value: unknown): value is WalletCurrency {
  return value === 'USD' || value === 'CDF';
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');
  const amount = Number(request.nextUrl.searchParams.get('amount'));

  if (!isCurrency(from) || !isCurrency(to) || from === to || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: 'Paramètres invalides' }, { status: 400 });
  }

  const quote = quoteExchange(from, to, amount);
  return NextResponse.json({ success: true, quote });
}
