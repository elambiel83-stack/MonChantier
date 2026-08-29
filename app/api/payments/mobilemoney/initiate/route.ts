import { NextRequest, NextResponse } from 'next/server';
import { confirmPayment } from '@/lib/paymentConfirmation';

function parsePositiveAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function sanitizeCurrency(value: unknown) {
  if (typeof value !== 'string') return 'CDF';
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3,5}$/.test(normalized) ? normalized : 'CDF';
}

function maskPhone(phone: string) {
  const compact = phone.replace(/\D/g, '');
  if (compact.length <= 4) return '****';
  return `${'*'.repeat(compact.length - 4)}${compact.slice(-4)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, currency, phone, network, fullname, email, customerName, customerEmail, tx_ref, metadata } = body;

    const items = Array.isArray(metadata?.items) ? metadata.items : [];
    const productSummary = items
      .map((item: { productName?: string; quantity?: number }) => `${item.productName || 'Produit'} x${item.quantity || 1}`)
      .join(', ');

    const parsedAmount = parsePositiveAmount(amount);
    const parsedCurrency = sanitizeCurrency(currency);

    if (!parsedAmount || !phone || !network || !tx_ref) {
      return NextResponse.json(
        { message: 'Montant, téléphone, réseau et référence requis' },
        { status: 400 }
      );
    }

    const normalizedPhone = String(phone).replace(/\s+/g, '');
    if (normalizedPhone.length < 8) {
      return NextResponse.json(
        { message: 'Numéro de téléphone invalide' },
        { status: 400 }
      );
    }

    // En production: intégration Klasha, Flutterwave ou autre
    console.log('=== DEMANDE DE PAIEMENT MOBILE MONEY ===');
    console.log('Montant:', parsedAmount, parsedCurrency);
    console.log('Téléphone:', maskPhone(normalizedPhone));
    console.log('Réseau:', network);
    console.log('Référence:', tx_ref);
    console.log('Résumé:', productSummary);
    console.log('=======================================');

    // Simuler un délai de traitement
    await new Promise(resolve => setTimeout(resolve, 1000));

    const resolvedCustomerName = (customerName || fullname || 'Client MonChantier').trim();
    const resolvedCustomerEmail = (customerEmail || email || '').trim();

    const result = await confirmPayment({
      reference: tx_ref,
      method: 'mobilemoney',
      amount: parsedAmount,
      currency: parsedCurrency,
      customerName: resolvedCustomerName,
      customerEmail: resolvedCustomerEmail,
      items: items.map((item: { productName?: string; quantity?: number; unitPrice?: number }) => ({
        productName: item.productName || 'Produit',
        quantity: Number(item.quantity || 1),
        unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : undefined,
      })),
      deliveryAddress: metadata?.deliveryAddress,
      location: metadata?.location,
    });

    return NextResponse.json({
      success: true,
      transaction_id: `TXN-${Date.now()}`,
      status: 'pending',
      message: `Demande envoyée à ${normalizedPhone}. Veuillez confirmer sur votre téléphone.`,
      reference: tx_ref,
      invoice: result.invoice,
    });
  } catch (error) {
    console.error('Erreur paiement Mobile Money:', error);
    return NextResponse.json(
      { message: 'Erreur lors du traitement du paiement' },
      { status: 500 }
    );
  }
}
