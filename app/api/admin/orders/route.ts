import { NextResponse } from 'next/server';
import { listPaymentStatuses } from '@/lib/paymentStore';

export async function GET() {
  const statuses = await listPaymentStatuses();
  const orders = statuses
    .filter((s) => s.state === 'confirmed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return NextResponse.json({ orders });
}
