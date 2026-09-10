import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileMoneyTransaction } from '@/lib/mobileMoney';
import { confirmPayment, ConfirmPaymentPayload } from '@/lib/paymentConfirmation';
import { getStoredPaymentStatus } from '@/lib/paymentStore';

/**
 * Vérifie un paiement Mobile Money auprès du prestataire avant de le
 * confirmer — jamais l'inverse. Appelé par le client en polling après
 * /api/payments/mobilemoney/initiate, le temps que l'utilisateur valide sur
 * son téléphone.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const reference = String(body?.reference || '').trim();
    if (!reference) {
      return NextResponse.json({ message: 'Référence requise' }, { status: 400 });
    }

    const stored = await getStoredPaymentStatus(reference);
    if (!stored || stored.method !== 'mobilemoney') {
      return NextResponse.json({ success: true, found: false, state: 'not_found' });
    }

    if (stored.state === 'confirmed') {
      return NextResponse.json({ success: true, found: true, state: 'confirmed', invoice: stored.invoice });
    }

    const pendingPayload = stored.pendingPayload as unknown as ConfirmPaymentPayload | undefined;
    if (!pendingPayload) {
      return NextResponse.json({ message: 'Paiement introuvable ou déjà traité' }, { status: 404 });
    }

    const verification = await verifyMobileMoneyTransaction(reference);

    if (verification.status === 'failed') {
      return NextResponse.json({ success: true, found: true, state: 'failed' });
    }
    if (verification.status === 'pending') {
      return NextResponse.json({ success: true, found: true, state: 'pending' });
    }

    // 'successful' : on ne confirme que si le montant/devise rapportés par
    // le prestataire correspondent à ce qui était attendu — jamais le montant
    // envoyé par le client à /initiate.
    const expectedAmount = Number(pendingPayload.amount);
    const expectedCurrency = String(pendingPayload.currency || '').toUpperCase();
    if (
      Math.round(verification.amount * 100) !== Math.round(expectedAmount * 100) ||
      verification.currency.toUpperCase() !== expectedCurrency
    ) {
      console.error(
        `Écart montant/devise à la vérification Mobile Money ${reference}: attendu ${expectedAmount} ${expectedCurrency}, prestataire ${verification.amount} ${verification.currency}`
      );
      return NextResponse.json({ message: 'Montant confirmé par le prestataire incohérent' }, { status: 409 });
    }

    const result = await confirmPayment(pendingPayload);
    return NextResponse.json({ found: true, state: 'confirmed', ...result });
  } catch (error) {
    console.error('Erreur vérification Mobile Money:', error);
    return NextResponse.json({ message: 'Erreur lors de la vérification du paiement' }, { status: 500 });
  }
}
