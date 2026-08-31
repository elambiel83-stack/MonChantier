import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canDecideLoan } from '@/lib/loanPermissions';
import { decideLoan } from '@/lib/loanStore';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
    if (!canDecideLoan(actor.role)) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const decision = body?.decision;
    const rejectionReason = typeof body?.rejectionReason === 'string' ? body.rejectionReason : undefined;

    if (decision !== 'approved' && decision !== 'rejected') {
      return NextResponse.json({ message: 'Décision invalide' }, { status: 400 });
    }

    const result = await decideLoan({ id: params.id, decision, decidedBy: actor.identity, rejectionReason });

    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 400;
      const message = result.error === 'not_found' ? 'Prêt introuvable' : "Ce prêt n'est plus décidable";
      return NextResponse.json({ message }, { status });
    }

    return NextResponse.json({ success: true, loan: result.loan });
  } catch (error) {
    console.error('Erreur décision prêt:', error);
    return NextResponse.json({ message: 'Erreur lors de la décision' }, { status: 500 });
  }
}
