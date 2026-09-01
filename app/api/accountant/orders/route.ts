import { NextRequest, NextResponse } from 'next/server';
import { listPaymentStatuses } from '@/lib/paymentStore';
import { requireRole } from '@/lib/requireRole';

export async function GET(request: NextRequest) {
  const denied = await requireRole(request, ['accountant']);
  if (denied) return denied;

  const statuses = await listPaymentStatuses();
  const orders = statuses
    .filter((s) => s.state === 'confirmed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return NextResponse.json({ orders });
}
