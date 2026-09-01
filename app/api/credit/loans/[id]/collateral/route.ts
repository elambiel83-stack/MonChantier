import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canWriteLoanEvidence } from '@/lib/loanPermissions';
import { addLoanCollateral, getLoanById, LoanCollateralType } from '@/lib/loanStore';
import { WalletCurrency } from '@/lib/walletExchange';

const VALID_TYPES: LoanCollateralType[] = ['terrain', 'immeuble', 'vehicule', 'autre'];

function isCurrency(value: unknown): value is WalletCurrency {
  return value === 'USD' || value === 'CDF';
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });

    const loan = await getLoanById(params.id);
    if (!loan) return NextResponse.json({ message: 'Prêt introuvable' }, { status: 404 });

    if (!canWriteLoanEvidence(actor, loan)) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const type = body?.type;
    const description = String(body?.description || '').trim();
    const estimatedValue = Number(body?.estimatedValue);
    const currency = body?.currency;
    const owner = String(body?.owner || '').trim();
    const documentId = typeof body?.documentId === 'string' ? body.documentId : undefined;

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ message: 'Type de garantie invalide' }, { status: 400 });
    }
    if (!description || !owner) {
      return NextResponse.json({ message: 'Description et propriétaire requis' }, { status: 400 });
    }
    if (!Number.isFinite(estimatedValue) || estimatedValue <= 0 || !isCurrency(currency)) {
      return NextResponse.json({ message: 'Valeur estimée invalide' }, { status: 400 });
    }

    const result = await addLoanCollateral({
      id: params.id,
      type,
      description,
      estimatedValue,
      currency,
      owner,
      documentId,
      addedBy: actor.identity,
    });

    if (!result.success) {
      return NextResponse.json({ message: 'Prêt introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true, collateral: result.collateral, loan: result.loan });
  } catch (error) {
    console.error('Erreur ajout garantie:', error);
    return NextResponse.json({ message: "Erreur lors de l'ajout de la garantie" }, { status: 500 });
  }
}
