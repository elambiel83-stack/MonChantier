import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canLogLoanCollection } from '@/lib/loanPermissions';
import { CollectionActionType, getLoanById, logCollectionAction } from '@/lib/loanStore';

const VALID_TYPES: CollectionActionType[] = [
  'called',
  'notified',
  'promise_to_pay',
  'payment_recorded',
  'escalated',
];

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
    const loan = await getLoanById(params.id);
    if (!loan) return NextResponse.json({ message: 'Prêt introuvable' }, { status: 404 });
    if (!canLogLoanCollection(actor, loan)) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const type = body?.type;
    const note = typeof body?.note === 'string' ? body.note : undefined;

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ message: 'Type action invalide' }, { status: 400 });
    }

    const result = await logCollectionAction({ id: params.id, by: actor.identity, type, note });
    if (!result.success) {
      return NextResponse.json({ message: 'Prêt introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true, loan: result.loan });
  } catch (error) {
    console.error('Erreur action de recouvrement:', error);
    return NextResponse.json({ message: "Erreur lors de l'enregistrement de l'action" }, { status: 500 });
  }
}
