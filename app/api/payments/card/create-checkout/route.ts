import { NextRequest, NextResponse } from 'next/server';
import { registerPendingPayment, confirmPayment } from '@/lib/paymentConfirmation';
import { encodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import { createStripeCheckoutSession, isStripeConfigured } from '@/lib/stripe';

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

    const parsedAmount = parsePositiveAmount(amount);
    const parsedCurrency = sanitizeCurrency(currency);

    if (!parsedAmount || !successUrl || !cancelUrl || normalizedItems.length === 0) {
      return NextResponse.json(
        { message: 'Montant, URLs de redirection et articles requis' },
        { status: 400 }
      );
    }

    const resolvedCustomerName = (customerName || 'Client MonChantier').trim();
    const resolvedCustomerEmail = (customerEmail || '').trim();
    const normalizedLineItems = normalizedItems.map(
      (item: { productName?: string; quantity?: number; unitPrice?: number }) => ({
        productName: item.productName || 'Produit',
        quantity: Number(item.quantity || 1),
        unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : undefined,
      })
    );

    if (isStripeConfigured()) {
      const paymentReference = `cs_${Date.now()}`;
      const invoicePayload = encodeInvoicePayload({
        reference: paymentReference,
        method: 'card',
        amount: parsedAmount,
        currency: parsedCurrency,
        customerName: resolvedCustomerName,
        customerEmail: resolvedCustomerEmail,
        items: normalizedLineItems,
        deliveryAddress,
        location,
      });

      const session = await createStripeCheckoutSession({
        amount: parsedAmount,
        currency: parsedCurrency,
        productSummary,
        successUrl: `${successUrl}?reference=${encodeURIComponent(paymentReference)}`,
        cancelUrl,
        customerEmail: resolvedCustomerEmail || undefined,
        invoicePayload,
      });

      await registerPendingPayment(paymentReference, 'card');

      return NextResponse.json({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.sessionId,
      });
    }

    // Pas de clé Stripe: mode démo, confirmation immédiate locale.
    console.log('=== CRÉATION CHECKOUT CARTE (MODE DEMO) ===');
    console.log('Montant:', parsedAmount, parsedCurrency);
    console.log('Résumé:', productSummary);
    console.log('============================================');

    await new Promise((resolve) => setTimeout(resolve, 500));

    const paymentReference = `cs_demo_${Date.now()}`;
    const result = await confirmPayment({
      reference: paymentReference,
      method: 'card',
      amount: parsedAmount,
      currency: parsedCurrency,
      customerName: resolvedCustomerName,
      customerEmail: resolvedCustomerEmail,
      items: normalizedLineItems,
      deliveryAddress,
      location,
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: `${successUrl}?reference=${encodeURIComponent(paymentReference)}&session_id=demo_${Date.now()}&amount=${amount}&items=${encodeURIComponent(productSummary)}`,
      sessionId: paymentReference,
      invoice: result.invoice,
    });
  } catch (error) {
    console.error('Erreur création checkout:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la création du checkout' },
      { status: 500 }
    );
  }
}
