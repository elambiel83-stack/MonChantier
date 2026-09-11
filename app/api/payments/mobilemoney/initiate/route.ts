import { NextRequest, NextResponse } from 'next/server';
import {
  confirmPayment,
  ConfirmPaymentPayload,
  generatePaymentReference,
  registerPendingPayment,
} from '@/lib/paymentConfirmation';
import { encodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import {
  initiateMobileMoneyPayment,
  isMobileMoneyConfigured,
  MobileMoneyNetwork,
  normalizeMobileMoneyPhone,
} from '@/lib/mobileMoney';

function parsePositiveAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function sanitizeCurrency(value: unknown) {
  if (typeof value !== 'string') return 'CDF';
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3,5}$/.test(normalized) ? normalized : 'CDF';
}

function sanitizeNetwork(value: unknown): MobileMoneyNetwork | null {
  return value === 'vodacom' || value === 'airtel' || value === 'orange' || value === 'mpesa'
    ? value
    : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, currency, phone, network, fullname, email, customerName, customerEmail, metadata } = body;

    const items = Array.isArray(metadata?.items) ? metadata.items : [];
    const productSummary = items
      .map((item: { productName?: string; quantity?: number }) => `${item.productName || 'Produit'} x${item.quantity || 1}`)
      .join(', ');

    const parsedAmount = parsePositiveAmount(amount);
    const parsedCurrency = sanitizeCurrency(currency);
    const parsedNetwork = sanitizeNetwork(network);

    // Validation
    if (!parsedAmount || !phone || !parsedNetwork) {
      return NextResponse.json(
        { message: 'Montant, téléphone et réseau valides requis' },
        { status: 400 }
      );
    }

    // Normaliser le numéro de téléphone
    const normalizedPhone = normalizeMobileMoneyPhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { message: 'Numéro de téléphone invalide' },
        { status: 400 }
      );
    }

    const resolvedCustomerName = (customerName || fullname || 'Client MonChantier').trim();
    const resolvedCustomerEmail = (customerEmail || email || '').trim();
    const reference = generatePaymentReference('MM');
    const paymentPayload: ConfirmPaymentPayload = {
      reference,
      customerName: resolvedCustomerName,
      customerEmail: resolvedCustomerEmail,
      method: 'mobilemoney',
      amount: parsedAmount,
      currency: parsedCurrency,
      items: items.map((item: { productName?: string; quantity?: number; unitPrice?: number }) => ({
        productName: item.productName || 'Produit',
        quantity: Number(item.quantity || 1),
        unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : undefined,
      })),
      deliveryAddress: metadata?.deliveryAddress,
      location: metadata?.location,
    };

    if (!isMobileMoneyConfigured()) {
      return NextResponse.json(
        { message: 'Paiement Mobile Money indisponible: configuration prestataire manquante.' },
        { status: 503 }
      );
    }

    const providerResponse = await initiateMobileMoneyPayment({
      amount: parsedAmount,
      currency: parsedCurrency,
      phone: normalizedPhone,
      network: parsedNetwork,
      reference,
      customerName: resolvedCustomerName,
      customerEmail: resolvedCustomerEmail,
      productSummary,
      invoicePayload: encodeInvoicePayload(paymentPayload),
    });

    await registerPendingPayment(reference, 'mobilemoney');

    if (providerResponse.status === 'confirmed') {
      const confirmation = await confirmPayment(paymentPayload);
      return NextResponse.json({
        success: true,
        transaction_id: providerResponse.transactionId,
        status: 'confirmed',
        message: providerResponse.message,
        reference,
        invoice: confirmation.invoice,
      });
    }

    return NextResponse.json({
      success: true,
      transaction_id: providerResponse.transactionId,
      status: 'pending',
      message:
        providerResponse.message ||
        `Demande envoyée à ${normalizedPhone}. Veuillez confirmer sur votre téléphone.`,
      reference,
      invoice: null,
    });
  } catch (error) {
    console.error('Erreur paiement Mobile Money:', error);
    return NextResponse.json(
      { message: 'Erreur lors du traitement du paiement' },
      { status: 500 }
    );
  }
}
