import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canAssignAgent } from '@/lib/loanPermissions';
import { assignAgent } from '@/lib/loanStore';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
    if (!canAssignAgent(actor.role)) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const agentIdentity = String(body?.agentIdentity || '').trim();
    if (!agentIdentity) {
      return NextResponse.json({ message: 'Identité agent requise' }, { status: 400 });
    }

    const result = await assignAgent({ id: params.id, agentIdentity, assignedBy: actor.identity });
    if (!result.success) {
      return NextResponse.json({ message: 'Prêt introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true, loan: result.loan });
  } catch (error) {
    console.error('Erreur assignation agent:', error);
    return NextResponse.json({ message: "Erreur lors de l'assignation" }, { status: 500 });
  }
}
