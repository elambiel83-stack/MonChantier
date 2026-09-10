import { NextRequest, NextResponse } from 'next/server';
import { recordPayment } from '@/lib/adminStore';
import { buildInvoiceText, createInvoice } from '@/lib/invoice';
import { isMailerConfigured, sendInvoiceEmail } from '@/lib/mailer';

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
    const totalQty = normalizedItems.reduce(
      (sum: number, item: { quantity?: number }) => sum + Number(item?.quantity || 0),
      0
    );
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

    // En production: utiliser Stripe, Paystack ou autre
    console.log('=== CRÉATION CHECKOUT CARTE BANCAIRE ===');
    console.log('Montant:', parsedAmount, parsedCurrency);
    console.log('Résumé:', productSummary);
    console.log('Quantité totale:', totalQty);
    console.log('Success URL:', successUrl);
    console.log('Cancel URL:', cancelUrl);
    console.log('Email fourni:', Boolean(customerEmail));
    console.log('========================================');

    // Simuler la création d'une session Stripe
    await new Promise(resolve => setTimeout(resolve, 500));

    const paymentReference = `cs_demo_${Date.now()}`;

    await recordPayment({
      method: 'card',
      amount: parsedAmount,
      currency: parsedCurrency,
      reference: paymentReference,
    });

    const resolvedCustomerName = (customerName || 'Client MonChantier').trim();
    const resolvedCustomerEmail = (customerEmail || '').trim();
    const invoice = createInvoice({
      reference: paymentReference,
      customerName: resolvedCustomerName,
      customerEmail: resolvedCustomerEmail,
      method: 'card',
      amount: parsedAmount,
      currency: parsedCurrency,
      items: normalizedItems.map((item: { productName?: string; quantity?: number; unitPrice?: number }) => ({
        productName: item.productName || 'Produit',
        quantity: Number(item.quantity || 1),
        unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : undefined,
      })),
      deliveryAddress,
      location,
    });

    let invoiceSent = false;
    if (resolvedCustomerEmail && isMailerConfigured()) {
      try {
        await sendInvoiceEmail({
          to: resolvedCustomerEmail,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          text: buildInvoiceText(invoice),
        });
        invoiceSent = true;
      } catch (mailError) {
        console.error('Erreur envoi facture carte:', mailError);
      }
    }

    // En production: retourner l'URL de checkout Stripe réel
    // Pour la démo, on simule avec une page locale
    return NextResponse.json({ 
      success: true,
      checkoutUrl: `${successUrl}?session_id=demo_${Date.now()}&amount=${amount}&items=${encodeURIComponent(productSummary)}`,
      sessionId: paymentReference,
      invoice: {
        number: invoice.invoiceNumber,
        sent: invoiceSent,
        email: resolvedCustomerEmail || null,
      },
    });
  } catch (error) {
    console.error('Erreur création checkout:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la création du checkout' },
      { status: 500 }
    );
  }
}
