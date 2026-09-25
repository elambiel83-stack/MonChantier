import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder, isPayPalConfigured } from '@/lib/paypal';
import { encodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import { confirmPayment, generatePaymentReference, registerPendingPayment } from '@/lib/paymentConfirmation';
import { OrderPricingError, priceOrderFromCatalog } from '@/lib/orderPricing';
import { isLivePaymentEnabled, paymentDisabledResponseMessage } from '@/lib/paymentAvailability';

export async function POST(request: NextRequest) {
  if (!isLivePaymentEnabled('paypal')) return NextResponse.json({ message: paymentDisabledResponseMessage('paypal') }, { status: 503 });
  try {
    const body = await request.json();
    const { items, currency, deliveryAddress, location, returnUrl, cancelUrl, customerName, customerEmail } = body;
    if (!returnUrl || !cancelUrl) {
      return NextResponse.json({ message: 'URLs de redirection requises' }, { status: 400 });
    }

    const order = await priceOrderFromCatalog(items, currency);
    if (order.currency !== 'USD') {
      return NextResponse.json({ message: 'PayPal ne prend en charge que le USD pour cette commande.' }, { status: 400 });
    }

    const reference = generatePaymentReference(isPayPalConfigured() ? 'PAYPAL' : 'PAYPAL-DEMO');
    const payload = {
      reference,
      method: 'paypal' as const,
      amount: order.amount,
      currency: order.currency,
      customerName: String(customerName || 'Client MonChantier').trim(),
      customerEmail: String(customerEmail || '').trim(),
      items: order.items,
      deliveryAddress,
      location,
    };

    if (isPayPalConfigured()) {
      const created = await createPayPalOrder({
        amount: order.amount,
        currency: order.currency,
        productSummary: order.summary,
        returnUrl: `${returnUrl}?paypal_order_id=${encodeURIComponent(reference)}`,
        cancelUrl,
        customId: encodeInvoicePayload(payload),
      });
      await registerPendingPayment(reference, 'paypal', payload);
      return NextResponse.json({ success: true, approveUrl: created.approveUrl, orderId: reference });
    }

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ message: 'Paiement PayPal indisponible : identifiants non configurés.' }, { status: 503 });
    }

    const result = await confirmPayment(payload);
    return NextResponse.json({
      success: true,
      approveUrl: `${returnUrl}?paypal_order_id=${encodeURIComponent(reference)}`,
      orderId: reference,
      invoice: result.invoice || null,
    });
  } catch (error) {
    if (error instanceof OrderPricingError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('Erreur création commande PayPal:', error);
    return NextResponse.json({ message: 'Erreur lors de la création de la commande PayPal' }, { status: 500 });
  }
}
