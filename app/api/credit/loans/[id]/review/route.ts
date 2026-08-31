import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canReviewLoan } from '@/lib/loanPermissions';
import { reviewLoan } from '@/lib/loanStore';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
    if (!canReviewLoan(actor.role)) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const note = typeof body?.note === 'string' ? body.note : undefined;

    const result = await reviewLoan({ id: params.id, reviewedBy: actor.identity, note });
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 400;
      const message = result.error === 'not_found' ? 'Prêt introuvable' : "Ce prêt n'est plus au statut soumis";
      return NextResponse.json({ message }, { status });
    }

    return NextResponse.json({ success: true, loan: result.loan });
  } catch (error) {
    console.error('Erreur mise en analyse prêt:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise en analyse' }, { status: 500 });
  }
}
