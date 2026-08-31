import { NextResponse } from 'next/server';
import { getWalletIdentity } from '@/lib/walletAuth';
import { getWallet } from '@/lib/walletStore';

export async function GET() {
  try {
    const identity = await getWalletIdentity();
    if (!identity) {
      return NextResponse.json({ message: 'Connexion avec email requise' }, { status: 401 });
    }

    const wallet = await getWallet(identity);
    return NextResponse.json({ success: true, wallet });
  } catch (error) {
    console.error('Erreur lecture porte-monnaie:', error);
    return NextResponse.json({ message: 'Erreur lors de la lecture du porte-monnaie' }, { status: 500 });
  }
}
