import { NextRequest, NextResponse } from 'next/server';
import { createStripeCheckoutSession, isStripeConfigured } from '@/lib/stripe';
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
    const { amount, currency, items, deliveryAddress, location, successUrl, cancelUrl, customerName, customerEmail } = body;

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
    if (!parsedAmount || !successUrl || !cancelUrl || normalizedItems.length === 0) {
      return NextResponse.json(
        { message: 'Montant, URLs de redirection et articles requis' },
        { status: 400 }
      );
    }

    const resolvedCustomerName = (customerName || 'Client MonChantier').trim();
    const resolvedCustomerEmail = (customerEmail || '').trim();

    if (isStripeConfigured()) {
      const reference = generatePaymentReference('cs');
      const invoicePayload = encodeInvoicePayload({
        reference,
        method: 'card',
        amount: parsedAmount,
        currency: parsedCurrency,
        customerName: resolvedCustomerName,
        customerEmail: resolvedCustomerEmail,
        items: invoiceItems,
        deliveryAddress,
        location,
      });

      const session = await createStripeCheckoutSession({
        amount: parsedAmount,
        currency: parsedCurrency,
        productSummary,
        successUrl: `${successUrl}?session_id=${encodeURIComponent(reference)}`,
        cancelUrl,
        customerEmail: resolvedCustomerEmail || undefined,
        invoicePayload,
      });

      // Paiement réel : la confirmation n'arrive que via le webhook Stripe
      // signé (/api/webhooks/stripe), jamais depuis cette réponse — le
      // client n'a encore rien payé à ce stade.
      await registerPendingPayment(reference, 'card');

      return NextResponse.json({ success: true, checkoutUrl: session.url, sessionId: reference });
    }

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { message: 'Paiement carte indisponible : STRIPE_SECRET_KEY non configuré.' },
        { status: 503 }
      );
    }

    // Mode démo (dev/local uniquement, sans clé Stripe) : confirmation
    // immédiate locale pour pouvoir tester le parcours sans compte Stripe.
    const paymentReference = `cs_demo_${Date.now()}`;
    const result = await confirmPayment({
      reference: paymentReference,
      method: 'card',
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
      checkoutUrl: `${successUrl}?session_id=demo_${Date.now()}&amount=${amount}&items=${encodeURIComponent(productSummary)}`,
      sessionId: paymentReference,
      invoice: result.invoice
        ? { number: result.invoice.number, sent: result.invoice.sent, email: result.invoice.email }
        : null,
    });
  } catch (error) {
    console.error('Erreur création checkout:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la création du checkout' },
      { status: 500 }
    );
  }
}
