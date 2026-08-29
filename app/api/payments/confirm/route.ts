import { NextRequest, NextResponse } from 'next/server';
import {
  confirmPayment,
  ConfirmPaymentPayload,
} from '@/lib/paymentConfirmation';

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.ADMIN_API_SECRET;
    const providedSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!expectedSecret || providedSecret !== expectedSecret) {
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
