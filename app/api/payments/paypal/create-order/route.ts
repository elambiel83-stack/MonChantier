import { NextRequest, NextResponse } from 'next/server';
import {
  confirmPayment,
  generatePaymentReference,
  registerPendingPayment,
} from '@/lib/paymentConfirmation';
import { encodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import { createPayPalOrder, isPayPalConfigured } from '@/lib/paypal';

function parsePositiveAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function sanitizeCurrency(value: unknown) {
  if (typeof value !== 'string') return 'CDF';
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3,5}$/.test(normalized) ? normalized : 'CDF';
}

function withSearchParam(url: string, key: string, value: string, baseOrigin: string) {
  const nextUrl = new URL(url, baseOrigin);
  nextUrl.searchParams.set(key, value);
  return nextUrl.toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, currency, items, deliveryAddress, location, returnUrl, cancelUrl, customerName, customerEmail } = body;

    const normalizedItems = Array.isArray(items) ? items : [];
    const productSummary = normalizedItems
      .map((item: { productName?: string; quantity?: number }) => `${item.productName || 'Produit'} x${item.quantity || 1}`)
      .join(', ');

    const parsedAmount = parsePositiveAmount(amount);
    const parsedCurrency = sanitizeCurrency(currency);

    // Validation
    if (!parsedAmount || !returnUrl || !cancelUrl || normalizedItems.length === 0) {
      return NextResponse.json(
        { message: 'Montant, URLs de redirection et articles requis' },
        { status: 400 }
      );
    }

    const paymentReference = generatePaymentReference('PAYPAL');
    const resolvedCustomerName = (customerName || 'Client MonChantier').trim();
    const resolvedCustomerEmail = (customerEmail || '').trim();
    const invoicePayload = encodeInvoicePayload({
      reference: paymentReference,
      method: 'paypal',
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

    const baseOrigin = request.nextUrl.origin;
    const returnUrlWithReference = withSearchParam(
      returnUrl,
      'reference',
      paymentReference,
      baseOrigin
    );

    if (isPayPalConfigured()) {
      await registerPendingPayment(paymentReference, 'paypal');
      const order = await createPayPalOrder({
        amount: parsedAmount,
        currency: parsedCurrency,
        productSummary,
        returnUrl: returnUrlWithReference,
        cancelUrl,
        customId: invoicePayload,
      });

      return NextResponse.json({
        success: true,
        approveUrl: order.approveUrl,
        orderId: order.orderId,
        reference: paymentReference,
      });
    }

    const confirmation = await confirmPayment({
      reference: paymentReference,
      method: 'paypal',
      amount: parsedAmount,
      currency: parsedCurrency,
      customerName: resolvedCustomerName,
      customerEmail: resolvedCustomerEmail,
      items: normalizedItems,
      deliveryAddress,
      location,
    });

    return NextResponse.json({
      success: true,
      approveUrl: withSearchParam(
        withSearchParam(
          withSearchParam(returnUrlWithReference, 'paypal_order_id', `demo_${Date.now()}`, baseOrigin),
          'amount',
          String(amount),
          baseOrigin
        ),
        'items',
        productSummary,
        baseOrigin
      ),
      orderId: paymentReference,
      reference: paymentReference,
      invoice: confirmation.invoice,
    });
  } catch (error) {
    console.error('Erreur création commande PayPal:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la création de la commande PayPal' },
      { status: 500 }
    );
  }
}
