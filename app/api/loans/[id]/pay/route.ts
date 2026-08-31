import { NextResponse } from 'next/server';
import { getWalletIdentity } from '@/lib/walletAuth';
import { payNextInstallment } from '@/lib/loanStore';

const ERROR_MESSAGES: Record<string, { message: string; status: number }> = {
  not_found: { message: 'Prêt introuvable', status: 404 },
  forbidden: { message: 'Ce prêt ne vous appartient pas', status: 403 },
  not_active: { message: "Ce prêt n'est pas actif", status: 400 },
  already_paid: { message: 'Toutes les échéances sont déjà payées', status: 400 },
  insufficient_balance: { message: "Solde du porte-monnaie insuffisant pour cette échéance", status: 400 },
};

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const identity = await getWalletIdentity();
    if (!identity) {
      return NextResponse.json({ message: 'Connexion avec email requise' }, { status: 401 });
    }

    const result = await payNextInstallment({ id: params.id, identity });
    if (!result.success) {
      const error = ERROR_MESSAGES[result.error];
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ success: true, loan: result.loan });
  } catch (error) {
    console.error('Erreur paiement échéance prêt:', error);
    return NextResponse.json({ message: "Erreur lors du paiement de l'échéance" }, { status: 500 });
  }
}
