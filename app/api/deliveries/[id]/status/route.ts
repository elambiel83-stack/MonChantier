import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canAssignDriver } from '@/lib/deliveryPermissions';
import { DeliveryStatus, updateDeliveryStatus } from '@/lib/deliveryStore';

const VALID_STATUSES: DeliveryStatus[] = [
  'pending',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
];

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });

    const body = await request.json();
    const status = body?.status;
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ message: 'Statut invalide' }, { status: 400 });
    }

    const isDriver = actor.role === 'driver';
    if (!isDriver && !canAssignDriver(actor.role)) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const result = await updateDeliveryStatus({
      id: params.id,
      status,
      by: actor.identity,
      requireDriverIdentity: isDriver ? actor.identity : undefined,
    });

    if (!result.success) {
      const statusCode =
        result.error === 'not_found' ? 404 : result.error === 'forbidden' ? 403 : 400;
      const message =
        result.error === 'not_found'
          ? 'Livraison introuvable'
          : result.error === 'forbidden'
          ? "Cette livraison ne vous est pas assignée"
          : 'Transition de statut invalide';
      return NextResponse.json({ message }, { status: statusCode });
    }

    return NextResponse.json({ success: true, delivery: result.delivery });
  } catch (error) {
    console.error('Erreur mise à jour statut livraison:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise à jour du statut' }, { status: 500 });
  }
}
