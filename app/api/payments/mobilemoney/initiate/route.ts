import { NextRequest, NextResponse } from 'next/server';
import { isMobileMoneyConfigured, initiateMobileMoneyCharge } from '@/lib/mobileMoney';
import { confirmPayment, generatePaymentReference, registerPendingPayment } from '@/lib/paymentConfirmation';
import { OrderPricingError, priceOrderFromCatalog } from '@/lib/orderPricing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currency, phone, network, fullname, email, customerName, customerEmail, metadata } = body;
    const normalizedPhone = String(phone || '').replace(/\s+/g, '');
    if (normalizedPhone.length < 8 || !network) {
      return NextResponse.json({ message: 'Téléphone et réseau valides requis' }, { status: 400 });
    }

    const order = await priceOrderFromCatalog(metadata?.items, currency);
    const reference = generatePaymentReference('MM');
    const payload = {
      reference,
      method: 'mobilemoney' as const,
      amount: order.amount,
      currency: order.currency,
      customerName: String(customerName || fullname || 'Client MonChantier').trim(),
      customerEmail: String(customerEmail || email || '').trim(),
      items: order.items,
      deliveryAddress: metadata?.deliveryAddress,
      location: metadata?.location,
    };

    if (isMobileMoneyConfigured()) {
      const charge = await initiateMobileMoneyCharge({
        amount: order.amount,
        currency: order.currency,
        phone: normalizedPhone,
        network,
        email: payload.customerEmail || undefined,
        fullname: payload.customerName,
        txRef: reference,
      });
      if (charge.status !== 'pending') {
        return NextResponse.json({ message: 'Le prestataire Mobile Money a refusé la demande.' }, { status: 502 });
      }
      await registerPendingPayment(reference, 'mobilemoney', payload);
      return NextResponse.json({
        success: true,
        status: 'pending',
        message: `Demande envoyée à ${normalizedPhone}. Veuillez confirmer sur votre téléphone.`,
        reference,
        redirectUrl: charge.redirectUrl,
      });
    }

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ message: 'Paiement Mobile Money indisponible : prestataire non configuré.' }, { status: 503 });
    }

    const result = await confirmPayment(payload);
    return NextResponse.json({
      success: true,
      transaction_id: `TXN-DEMO-${Date.now()}`,
      status: 'confirmed',
      reference,
      invoice: result.invoice || null,
    });
  } catch (error) {
    if (error instanceof OrderPricingError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('Erreur paiement Mobile Money:', error);
    return NextResponse.json({ message: 'Erreur lors du traitement du paiement' }, { status: 500 });
  }
}
