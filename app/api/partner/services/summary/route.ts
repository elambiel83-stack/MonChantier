import { NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { listPaymentStatuses } from '@/lib/paymentStore';
import { listAllQuoteRequests } from '@/lib/quoteStore';
import { buildTechnicianSummary } from '@/lib/partnerDashboardSummary';
import { listServicesByOwner } from '@/lib/serviceStore';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
  if (actor.role !== 'technician') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const [services, payments, quotes] = await Promise.all([
    listServicesByOwner(actor.identity),
    listPaymentStatuses(),
    listAllQuoteRequests(),
  ]);

  return NextResponse.json(buildTechnicianSummary(services, payments, quotes));
}
