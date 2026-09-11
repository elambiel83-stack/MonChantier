import { NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { listPaymentStatuses } from '@/lib/paymentStore';
import { listProductsByOwner } from '@/lib/productStore';
import { buildSupplierSummary } from '@/lib/partnerDashboardSummary';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
  if (actor.role !== 'supplier') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const [products, payments] = await Promise.all([
    listProductsByOwner(actor.identity),
    listPaymentStatuses(),
  ]);

  return NextResponse.json(buildSupplierSummary(products, payments));
}
