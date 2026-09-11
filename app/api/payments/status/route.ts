import { NextRequest, NextResponse } from 'next/server';
import { getPaymentStatus } from '@/lib/paymentConfirmation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get('reference');

  if (!reference) {
    return NextResponse.json(
      { message: 'Référence de paiement requise' },
      { status: 400 }
    );
  }

  const status = await getPaymentStatus(reference);
  if (!status) {
    return NextResponse.json({
      success: true,
      found: false,
      state: 'not_found',
    });
  }

  return NextResponse.json({
    success: true,
    found: true,
    ...status,
  });
}
