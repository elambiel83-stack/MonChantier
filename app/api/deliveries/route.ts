import { NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canViewAllDeliveries } from '@/lib/deliveryPermissions';
import {
  listAllDeliveries,
  listDeliveriesByClient,
  listDeliveriesByDriver,
  listUnassignedDeliveries,
} from '@/lib/deliveryStore';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });

  if (canViewAllDeliveries(actor.role)) {
    const deliveries = await listAllDeliveries();
    return NextResponse.json({ success: true, deliveries });
  }

  if (actor.role === 'driver') {
    const [mine, unassigned] = await Promise.all([
      listDeliveriesByDriver(actor.identity),
      listUnassignedDeliveries(),
    ]);
    return NextResponse.json({ success: true, deliveries: mine, available: unassigned });
  }

  const deliveries = await listDeliveriesByClient(actor.identity);
  return NextResponse.json({ success: true, deliveries });
}
