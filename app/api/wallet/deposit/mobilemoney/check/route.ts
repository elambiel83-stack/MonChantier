import { NextRequest, NextResponse } from 'next/server';
import { getWalletIdentity } from '@/lib/walletAuth';
import { verifyMobileMoneyTransaction } from '@/lib/mobileMoney';
import { confirmDeposit, getWallet } from '@/lib/walletStore';

/**
 * Vérifie une recharge Mobile Money auprès du prestataire avant de créditer
 * le porte-monnaie — jamais l'inverse. Appelé par le client en polling après
 * /api/wallet/deposit/mobilemoney.
 */
export async function POST(request: NextRequest) {
  try {
    const identity = await getWalletIdentity();
    if (!identity) {
      return NextResponse.json({ message: 'Connexion avec email requise' }, { status: 401 });
    }

    const body = await request.json();
    const reference = String(body?.reference || '').trim();
    if (!reference) {
      return NextResponse.json({ message: 'Référence requise' }, { status: 400 });
    }

    const wallet = await getWallet(identity);
    const pending = wallet.transactions.find(
      (tx) => tx.type === 'deposit' && tx.reference === reference && tx.method === 'mobilemoney'
    );
    if (!pending || pending.type !== 'deposit') {
      return NextResponse.json({ success: true, found: false, state: 'not_found' });
    }
    if (pending.state === 'confirmed') {
      return NextResponse.json({ success: true, found: true, state: 'confirmed', wallet });
    }

    const verification = await verifyMobileMoneyTransaction(reference);

    if (verification.status === 'failed') {
      return NextResponse.json({ success: true, found: true, state: 'failed' });
    }
    if (verification.status === 'pending') {
      return NextResponse.json({ success: true, found: true, state: 'pending' });
    }

    // 'successful' : on ne crédite que si le montant/devise rapportés par le
    // prestataire correspondent à la recharge demandée — jamais le montant
    // envoyé par le client à /deposit/mobilemoney.
    if (
      Math.round(verification.amount * 100) !== Math.round(pending.amount * 100) ||
      verification.currency.toUpperCase() !== pending.currency.toUpperCase()
    ) {
      console.error(
        `Écart montant/devise à la vérification recharge Mobile Money ${reference}: attendu ${pending.amount} ${pending.currency}, prestataire ${verification.amount} ${verification.currency}`
      );
      return NextResponse.json({ message: 'Montant confirmé par le prestataire incohérent' }, { status: 409 });
    }

    const { wallet: updatedWallet } = await confirmDeposit({
      identity,
      reference,
      method: 'mobilemoney',
      currency: pending.currency,
      amount: pending.amount,
    });

    return NextResponse.json({ success: true, found: true, state: 'confirmed', wallet: updatedWallet });
  } catch (error) {
    console.error('Erreur vérification recharge Mobile Money:', error);
    return NextResponse.json({ message: 'Erreur lors de la vérification de la recharge' }, { status: 500 });
  }
}
