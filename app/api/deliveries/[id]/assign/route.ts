import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canAssignDriver } from '@/lib/deliveryPermissions';
import { assignDriver } from '@/lib/deliveryStore';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });

    const body = await request.json();
    const driverIdentity = String(body?.driverIdentity || '').trim();

    // Un livreur peut s'auto-assigner une mission disponible; un admin peut
    // assigner n'importe quel livreur à n'importe quelle livraison.
    const isSelfAssign = actor.role === 'driver' && driverIdentity === actor.identity;
    if (!isSelfAssign && !canAssignDriver(actor.role)) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    if (!driverIdentity) {
      return NextResponse.json({ message: 'Identité livreur requise' }, { status: 400 });
    }

    const result = await assignDriver({ id: params.id, driverIdentity, assignedBy: actor.identity });
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 400;
      const message = result.error === 'not_found' ? 'Livraison introuvable' : 'Déjà assignée à un livreur';
      return NextResponse.json({ message }, { status });
    }

    return NextResponse.json({ success: true, delivery: result.delivery });
  } catch (error) {
    console.error('Erreur assignation livreur:', error);
    return NextResponse.json({ message: "Erreur lors de l'assignation" }, { status: 500 });
  }
}
