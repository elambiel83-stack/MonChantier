import { timingSafeEqual, createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  confirmPayment,
  ConfirmPaymentPayload,
} from '@/lib/paymentConfirmation';

function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.ADMIN_API_SECRET;
    const providedSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';

    if (!expectedSecret || !safeEqual(providedSecret, expectedSecret)) {
      return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
    }

    const body = (await request.json()) as ConfirmPaymentPayload;

    const result = await confirmPayment(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erreur confirmation paiement:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la confirmation du paiement' },
      { status: 500 }
    );
  }
}
