import { NextResponse } from 'next/server';
import { listPaymentStatuses } from '@/lib/paymentStore';
import { computeTaxSummary } from '@/lib/taxSummary';

export async function GET() {
  const statuses = await listPaymentStatuses();
  const summary = computeTaxSummary(statuses);
  return NextResponse.json(summary);
}
