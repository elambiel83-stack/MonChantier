import { NextResponse } from 'next/server';
import { listAllDeliveries } from '@/lib/deliveryStore';
import { listPaymentStatuses } from '@/lib/paymentStore';
import { canManageSite } from '@/lib/sitePermissions';
import { getSessionActor } from '@/lib/sessionIdentity';
import { getSiteById } from '@/lib/siteStore';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const site = await getSiteById(params.id);
  if (!site) return NextResponse.json({ message: 'Chantier introuvable' }, { status: 404 });
  if (!canManageSite(actor, site)) {
    return NextResponse.json({ message: 'Ce chantier ne vous appartient pas' }, { status: 403 });
  }

  const [payments, deliveries] = await Promise.all([listPaymentStatuses(), listAllDeliveries()]);

  const orders = site.orderReferences.map((entry) => {
    const order = payments.find((payment) => payment.reference === entry.reference);
    return {
      reference: entry.reference,
      addedAt: entry.addedAt,
      found: Boolean(order),
      paymentState: order?.state || null,
      orderStatus: order?.orderStatus || null,
      amount: order?.fullInvoice?.totalTTC ?? order?.invoice?.totals.ttc ?? null,
      currency: order?.fullInvoice?.currency || order?.invoice?.totals.currency || null,
      customerName: order?.fullInvoice?.customerName || order?.invoice?.email || null,
      updatedAt: order?.updatedAt || null,
    };
  });

  const linkedDeliveries = site.deliveryReferences.map((entry) => {
    const delivery = deliveries.find((item) => item.reference === entry.reference);
    return {
      reference: entry.reference,
      addedAt: entry.addedAt,
      found: Boolean(delivery),
      status: delivery?.status || null,
      deliveryAddress: delivery?.deliveryAddress || null,
      driverIdentity: delivery?.driverIdentity || null,
      updatedAt: delivery?.currentPosition?.at || delivery?.statusHistory.at(-1)?.at || delivery?.createdAt || null,
    };
  });

  return NextResponse.json({ orders, deliveries: linkedDeliveries });
}
