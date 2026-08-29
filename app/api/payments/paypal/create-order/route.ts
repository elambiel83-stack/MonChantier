import { NextRequest, NextResponse } from 'next/server';
import { registerPendingPayment, confirmPayment } from '@/lib/paymentConfirmation';
import { encodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import { createPayPalOrder, isPayPalConfigured } from '@/lib/paypal';

// Devises acceptées par l'API PayPal (le CDF n'en fait pas partie).
const PAYPAL_SUPPORTED_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'HKD', 'NZD',
  'SGD', 'SEK', 'DKK', 'PLN', 'NOK', 'HUF', 'CZK', 'ILS', 'MXN', 'MYR',
  'PHP', 'TWD', 'THB', 'BRL',
]);

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

    const parsedAmount = parsePositiveAmount(amount);
    const parsedCurrency = sanitizeCurrency(currency);

    if (!parsedAmount || !returnUrl || !cancelUrl || normalizedItems.length === 0) {
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

    if (isPayPalConfigured()) {
      if (!PAYPAL_SUPPORTED_CURRENCIES.has(parsedCurrency)) {
        return NextResponse.json(
          {
            message: `PayPal ne prend pas en charge la devise ${parsedCurrency}. Merci de sélectionner USD pour ce moyen de paiement.`,
          },
          { status: 400 }
        );
      }

      const paymentReference = `PAYPAL-${Date.now()}`;
      const invoicePayload = encodeInvoicePayload({
        reference: paymentReference,
        method: 'paypal',
        amount: parsedAmount,
        currency: parsedCurrency,
        customerName: resolvedCustomerName,
        customerEmail: resolvedCustomerEmail,
        items: normalizedLineItems,
        deliveryAddress,
        location,
      });

      const order = await createPayPalOrder({
        amount: parsedAmount,
        currency: parsedCurrency,
        productSummary,
        returnUrl: `${returnUrl}?reference=${encodeURIComponent(paymentReference)}`,
        cancelUrl,
        customId: invoicePayload,
      });

      await registerPendingPayment(paymentReference, 'paypal');

      return NextResponse.json({
        success: true,
        approveUrl: order.approveUrl,
        orderId: order.orderId,
      });
    }

    // Pas de credentials PayPal: mode démo, confirmation immédiate locale.
    console.log('=== COMMANDE PAYPAL (MODE DEMO) ===');
    console.log('Montant:', parsedAmount, parsedCurrency);
    console.log('Résumé:', productSummary);
    console.log('====================================');

    await new Promise((resolve) => setTimeout(resolve, 500));

    const paymentReference = `PAYPAL-DEMO-${Date.now()}`;
    const result = await confirmPayment({
      reference: paymentReference,
      method: 'paypal',
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
      approveUrl: `${returnUrl}?reference=${encodeURIComponent(paymentReference)}&paypal_order_id=demo_${Date.now()}&amount=${amount}&items=${encodeURIComponent(productSummary)}`,
      orderId: paymentReference,
      invoice: result.invoice,
    });
  } catch (error) {
    console.error('Erreur création commande PayPal:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la création de la commande PayPal' },
      { status: 500 }
    );
  }
}
