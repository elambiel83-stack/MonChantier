import { NextRequest, NextResponse } from 'next/server';
import { createStripeCheckoutSession, isStripeConfigured } from '@/lib/stripe';
import { encodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import { confirmPayment, generatePaymentReference, registerPendingPayment } from '@/lib/paymentConfirmation';
import { OrderPricingError, priceOrderFromCatalog } from '@/lib/orderPricing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, currency, deliveryAddress, location, successUrl, cancelUrl, customerName, customerEmail } = body;
    if (!successUrl || !cancelUrl) {
      return NextResponse.json({ message: 'URLs de redirection requises' }, { status: 400 });
    }

    const order = await priceOrderFromCatalog(items, currency);
    const reference = generatePaymentReference(isStripeConfigured() ? 'cs' : 'cs_demo');
    const payload = {
      reference,
      method: 'card' as const,
      amount: order.amount,
      currency: order.currency,
      customerName: String(customerName || 'Client MonChantier').trim(),
      customerEmail: String(customerEmail || '').trim(),
      items: order.items,
      deliveryAddress,
      location,
    };

    if (isStripeConfigured()) {
      const session = await createStripeCheckoutSession({
        amount: order.amount,
        currency: order.currency,
        productSummary: order.summary,
        successUrl: `${successUrl}?session_id=${encodeURIComponent(reference)}`,
        cancelUrl,
        customerEmail: payload.customerEmail || undefined,
        invoicePayload: encodeInvoicePayload(payload),
      });
      await registerPendingPayment(reference, 'card', payload);
      return NextResponse.json({ success: true, checkoutUrl: session.url, sessionId: reference });
    }

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ message: 'Paiement carte indisponible : Stripe non configuré.' }, { status: 503 });
    }

    const result = await confirmPayment(payload);
    return NextResponse.json({
      success: true,
      checkoutUrl: `${successUrl}?session_id=${encodeURIComponent(reference)}`,
      sessionId: reference,
      invoice: result.invoice || null,
    });
  } catch (error) {
    if (error instanceof OrderPricingError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('Erreur création checkout:', error);
    return NextResponse.json({ message: 'Erreur lors de la création du checkout' }, { status: 500 });
  }
}
