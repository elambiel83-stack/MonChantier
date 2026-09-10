import { NextRequest, NextResponse } from 'next/server';
import { recordPayment } from '@/lib/adminStore';
import { requireAdmin } from '@/lib/requireAdmin';

const demoRows = [
  { method: 'mobilemoney' as const, amount: 125000, currency: 'CDF', reference: 'MM-DEMO-001' },
  { method: 'card' as const, amount: 85, currency: 'USD', reference: 'CARD-DEMO-002' },
  { method: 'paypal' as const, amount: 64, currency: 'USD', reference: 'PP-DEMO-003' },
  { method: 'mobilemoney' as const, amount: 240000, currency: 'CDF', reference: 'MM-DEMO-004' },
];

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  for (const row of demoRows) {
    await recordPayment({
      method: row.method,
      amount: row.amount,
      currency: row.currency,
      reference: row.reference,
    });
  }

  return NextResponse.json({
    success: true,
    generated: demoRows.length,
    message: 'Paiements de démo générés',
  });
}
