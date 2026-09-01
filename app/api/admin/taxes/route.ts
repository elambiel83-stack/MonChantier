import { NextRequest, NextResponse } from 'next/server';
import { listPaymentStatuses } from '@/lib/paymentStore';
import { computeTaxSummary } from '@/lib/taxSummary';
import { requireAdmin } from '@/lib/requireAdmin';

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const statuses = await listPaymentStatuses();
  const summary = computeTaxSummary(statuses);
  return NextResponse.json(summary);
}
