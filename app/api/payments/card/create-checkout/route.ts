import { NextRequest, NextResponse } from 'next/server';
import {
  generatePaymentReference,
  registerPendingPayment,
} from '@/lib/paymentConfirmation';
import { encodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import { resolveTrustedRedirectUrl, withSearchParam } from '@/lib/paymentRedirect';
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

    // Validation
    if (!parsedAmount || !successUrl || !cancelUrl || normalizedItems.length === 0) {
      return NextResponse.json(
        { message: 'Montant, URLs de redirection et articles requis' },
        { status: 400 }
      );
    }

    const baseOrigin = request.nextUrl.origin;
    const safeSuccessUrl = resolveTrustedRedirectUrl(successUrl, baseOrigin);
    const safeCancelUrl = resolveTrustedRedirectUrl(cancelUrl, baseOrigin);
    if (!safeSuccessUrl.ok || !safeCancelUrl.ok) {
      return NextResponse.json(
        { message: 'URLs de redirection invalides' },
        { status: 400 }
      );
    }

    const paymentReference = generatePaymentReference('CARD');
    const resolvedCustomerName = (customerName || 'Client MonChantier').trim();
    const resolvedCustomerEmail = (customerEmail || '').trim();
    const invoicePayload = encodeInvoicePayload({
      reference: paymentReference,
      method: 'card',
      amount: parsedAmount,
      currency: parsedCurrency,
      customerName: resolvedCustomerName,
      customerEmail: resolvedCustomerEmail,
      items: normalizedItems.map((item: { productName?: string; quantity?: number; unitPrice?: number }) => ({
        productName: item.productName || 'Produit',
        quantity: Number(item.quantity || 1),
        unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : undefined,
      })),
      deliveryAddress,
      location,
    });

    const successUrlWithReference = withSearchParam(
      safeSuccessUrl.url,
      'reference',
      paymentReference,
      baseOrigin
    );

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { message: 'Paiement carte indisponible: STRIPE_SECRET_KEY manquant.' },
        { status: 503 }
      );
    }

    const session = await createStripeCheckoutSession({
      amount: parsedAmount,
      currency: parsedCurrency,
      productSummary,
      successUrl: successUrlWithReference,
      cancelUrl: safeCancelUrl.url,
      customerEmail: resolvedCustomerEmail || undefined,
      invoicePayload,
    });
    await registerPendingPayment(paymentReference, 'card');

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.sessionId,
      reference: paymentReference,
    });
  } catch (error) {
    console.error('Erreur création checkout:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la création du checkout' },
      { status: 500 }
    );
  }
}
