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
    const { amount, currency, items, deliveryAddress, location, returnUrl, cancelUrl, customerName, customerEmail } = body;

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
    if (!parsedAmount || !returnUrl || !cancelUrl || normalizedItems.length === 0) {
      return NextResponse.json(
        { message: 'Montant, URLs de redirection et articles requis' },
        { status: 400 }
      );
    }

    // En production: utiliser PayPal SDK
    console.log('=== CRÉATION COMMANDE PAYPAL ===');
    console.log('Montant:', parsedAmount, parsedCurrency);
    console.log('Résumé:', productSummary);
    console.log('Quantité totale:', totalQty);
    console.log('Return URL:', returnUrl);
    console.log('Cancel URL:', cancelUrl);
    console.log('Email fourni:', Boolean(customerEmail));
    console.log('================================');

    // Simuler la création d'une commande PayPal
    await new Promise(resolve => setTimeout(resolve, 500));

    const paymentReference = `PAYPAL-${Date.now()}`;

    recordPayment({
      method: 'paypal',
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
      method: 'paypal',
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
        console.error('Erreur envoi facture PayPal:', mailError);
      }
    }

    // En production: retourner l'URL d'approbation PayPal réelle
    // Pour la démo, on simule avec une page locale
    return NextResponse.json({ 
      success: true,
      approveUrl: `${returnUrl}?paypal_order_id=demo_${Date.now()}&amount=${amount}&items=${encodeURIComponent(productSummary)}`,
      orderId: paymentReference,
      invoice: {
        number: invoice.invoiceNumber,
        sent: invoiceSent,
        email: resolvedCustomerEmail || null,
      },
    });
  } catch (error) {
    console.error('Erreur création commande PayPal:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la création de la commande PayPal' },
      { status: 500 }
    );
  }
}
