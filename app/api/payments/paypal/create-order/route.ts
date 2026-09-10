import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder, isPayPalConfigured } from '@/lib/paypal';
import { encodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import { confirmPayment, generatePaymentReference, registerPendingPayment } from '@/lib/paymentConfirmation';

function parsePositiveAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function sanitizeCurrency(value: unknown) {
  if (typeof value !== 'string') return 'CDF';
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3,5}$/.test(normalized) ? normalized : 'CDF';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, currency, items, deliveryAddress, location, returnUrl, cancelUrl, customerName, customerEmail } = body;

    const normalizedItems = Array.isArray(items) ? items : [];
    const productSummary = normalizedItems
      .map((item: { productName?: string; quantity?: number }) => `${item.productName || 'Produit'} x${item.quantity || 1}`)
      .join(', ');
    const invoiceItems = normalizedItems.map((item: { productId?: number; productName?: string; quantity?: number; unitPrice?: number }) => ({
      productId: typeof item?.productId === 'number' ? item.productId : undefined,
      productName: item.productName || 'Produit',
      quantity: Number(item.quantity || 1),
      unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : undefined,
    }));

    const parsedAmount = parsePositiveAmount(amount);
    const parsedCurrency = sanitizeCurrency(currency);

    // Validation
    if (!parsedAmount || !returnUrl || !cancelUrl || normalizedItems.length === 0) {
      return NextResponse.json(
        { message: 'Montant, URLs de redirection et articles requis' },
        { status: 400 }
      );
    }

    const resolvedCustomerName = (customerName || 'Client MonChantier').trim();
    const resolvedCustomerEmail = (customerEmail || '').trim();

    if (isPayPalConfigured()) {
      if (parsedCurrency !== 'USD') {
        return NextResponse.json(
          { message: 'PayPal ne prend en charge que le USD pour cette commande.' },
          { status: 400 }
        );
      }

      const reference = generatePaymentReference('PAYPAL');
      const invoicePayload = encodeInvoicePayload({
        reference,
        method: 'paypal',
        amount: parsedAmount,
        currency: parsedCurrency,
        customerName: resolvedCustomerName,
        customerEmail: resolvedCustomerEmail,
        items: invoiceItems,
        deliveryAddress,
        location,
      });

      const order = await createPayPalOrder({
        amount: parsedAmount,
        currency: parsedCurrency,
        productSummary,
        returnUrl: `${returnUrl}?paypal_order_id=${encodeURIComponent(reference)}`,
        cancelUrl,
        customId: invoicePayload,
      });

      // Paiement réel : la confirmation n'arrive que via le webhook PayPal
      // signé (/api/webhooks/paypal), jamais depuis cette réponse — le
      // client n'a encore rien payé à ce stade.
      await registerPendingPayment(reference, 'paypal');

      return NextResponse.json({ success: true, approveUrl: order.approveUrl, orderId: reference });
    }

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { message: 'Paiement PayPal indisponible : PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET non configurés.' },
        { status: 503 }
      );
    }

    // Mode démo (dev/local uniquement, sans credentials PayPal) : confirmation
    // immédiate locale pour pouvoir tester le parcours sans compte PayPal.
    const paymentReference = `PAYPAL-DEMO-${Date.now()}`;
    const result = await confirmPayment({
      reference: paymentReference,
      method: 'paypal',
      amount: parsedAmount,
      currency: parsedCurrency,
      customerName: resolvedCustomerName,
      customerEmail: resolvedCustomerEmail,
      items: invoiceItems,
      deliveryAddress,
      location,
    });

    return NextResponse.json({
      success: true,
      approveUrl: `${returnUrl}?paypal_order_id=demo_${Date.now()}&amount=${amount}&items=${encodeURIComponent(productSummary)}`,
      orderId: paymentReference,
      invoice: result.invoice
        ? { number: result.invoice.number, sent: result.invoice.sent, email: result.invoice.email }
        : null,
    });
  } catch (error) {
    console.error('Erreur création commande PayPal:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la création de la commande PayPal' },
      { status: 500 }
    );
  }
}
