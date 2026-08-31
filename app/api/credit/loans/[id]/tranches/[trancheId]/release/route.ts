import { NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canReleaseTranche } from '@/lib/loanPermissions';
import { releaseTranche } from '@/lib/loanStore';

const ERROR_MESSAGES: Record<string, { message: string; status: number }> = {
  not_found: { message: 'Prêt introuvable', status: 404 },
  tranche_not_found: { message: 'Tranche introuvable', status: 404 },
  not_active: { message: "Ce prêt n'est pas actif", status: 400 },
  already_released: { message: 'Cette tranche a déjà été libérée', status: 400 },
};

export async function POST(
  _request: Request,
  { params }: { params: { id: string; trancheId: string } }
) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
    if (!canReleaseTranche(actor.role)) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const result = await releaseTranche({
      id: params.id,
      trancheId: params.trancheId,
      releasedBy: actor.identity,
    });

    if (!result.success) {
      const error = ERROR_MESSAGES[result.error];
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ success: true, loan: result.loan });
  } catch (error) {
    console.error('Erreur libération tranche:', error);
    return NextResponse.json({ message: 'Erreur lors de la libération de la tranche' }, { status: 500 });
  }
}
