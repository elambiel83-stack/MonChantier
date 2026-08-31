import { NextRequest, NextResponse } from 'next/server';
import { getWalletIdentity } from '@/lib/walletAuth';
import { getWallet } from '@/lib/walletStore';

export async function GET(request: NextRequest) {
  try {
    const identity = await getWalletIdentity();
    if (!identity) {
      return NextResponse.json({ message: 'Connexion avec email requise' }, { status: 401 });
    }

    const reference = request.nextUrl.searchParams.get('reference');
    if (!reference) {
      return NextResponse.json({ message: 'Référence requise' }, { status: 400 });
    }

    const wallet = await getWallet(identity);
    const transaction = wallet.transactions.find(
      (tx) => tx.type === 'deposit' && tx.reference === reference
    );

    if (!transaction) {
      return NextResponse.json({ success: true, found: false, state: 'not_found' });
    }

    return NextResponse.json({ success: true, found: true, transaction });
  } catch (error) {
    console.error('Erreur statut recharge porte-monnaie:', error);
    return NextResponse.json({ message: 'Erreur lors de la vérification du statut' }, { status: 500 });
  }
}
