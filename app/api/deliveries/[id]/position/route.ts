import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { reportDeliveryPosition } from '@/lib/deliveryStore';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
    if (actor.role !== 'driver') {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ message: 'Coordonnées invalides' }, { status: 400 });
    }

    const result = await reportDeliveryPosition({ id: params.id, driverIdentity: actor.identity, lat, lng });
    if (!result.success) {
      const statusCode =
        result.error === 'not_found' ? 404 : result.error === 'forbidden' ? 403 : 400;
      const message =
        result.error === 'not_found'
          ? 'Livraison introuvable'
          : result.error === 'forbidden'
          ? "Cette livraison ne vous est pas assignée"
          : "La livraison n'est pas en cours";
      return NextResponse.json({ message }, { status: statusCode });
    }

    return NextResponse.json({ success: true, delivery: result.delivery });
  } catch (error) {
    console.error('Erreur envoi position livraison:', error);
    return NextResponse.json({ message: "Erreur lors de l'envoi de la position" }, { status: 500 });
  }
}
