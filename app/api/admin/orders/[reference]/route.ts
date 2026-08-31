import { NextRequest, NextResponse } from 'next/server';
import { OrderStatus, updateOrderStatus } from '@/lib/paymentStore';

const VALID_STATUSES: OrderStatus[] = ['processing', 'shipped', 'delivered', 'cancelled'];

export async function PATCH(request: NextRequest, { params }: { params: { reference: string } }) {
  try {
    const body = await request.json();
    const nextStatus = String(body?.orderStatus || '') as OrderStatus;
    const cancelReason = typeof body?.cancelReason === 'string' ? body.cancelReason.trim() : undefined;

    if (!VALID_STATUSES.includes(nextStatus)) {
      return NextResponse.json({ message: 'Statut de commande invalide' }, { status: 400 });
    }

    const result = await updateOrderStatus(decodeURIComponent(params.reference), nextStatus, cancelReason);
    if ('error' in result) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, order: result.status });
  } catch (error) {
    console.error('Erreur mise à jour commande:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise à jour de la commande' }, { status: 500 });
  }
}
