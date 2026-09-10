import { NextRequest, NextResponse } from 'next/server';
import { isMobileMoneyConfigured, initiateMobileMoneyCharge } from '@/lib/mobileMoney';
import { confirmPayment, registerPendingPayment } from '@/lib/paymentConfirmation';

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
    const { amount, currency, phone, network, fullname, email, customerName, customerEmail, tx_ref, metadata } = body;

    const items = Array.isArray(metadata?.items) ? metadata.items : [];
    const invoiceItems = items.map((item: { productId?: number; productName?: string; quantity?: number; unitPrice?: number }) => ({
      productId: typeof item?.productId === 'number' ? item.productId : undefined,
      productName: item.productName || 'Produit',
      quantity: Number(item.quantity || 1),
      unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : undefined,
    }));

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

    const resolvedCustomerName = (customerName || fullname || 'Client MonChantier').trim();
    const resolvedCustomerEmail = (customerEmail || email || '').trim();

    if (isMobileMoneyConfigured()) {
      const charge = await initiateMobileMoneyCharge({
        amount: parsedAmount,
        currency: parsedCurrency,
        phone: normalizedPhone,
        network,
        email: resolvedCustomerEmail || undefined,
        fullname: resolvedCustomerName,
        txRef: tx_ref,
      });

      if (charge.status !== 'pending') {
        return NextResponse.json({ message: 'Le prestataire Mobile Money a refusé la demande.' }, { status: 502 });
      }

      // Rien n'est confirmé ici : seule la vérification côté serveur via
      // /api/payments/mobilemoney/check (après validation du client sur son
      // téléphone) peut faire passer ce paiement à "confirmed".
      await registerPendingPayment(tx_ref, 'mobilemoney', {
        reference: tx_ref,
        method: 'mobilemoney',
        amount: parsedAmount,
        currency: parsedCurrency,
        customerName: resolvedCustomerName,
        customerEmail: resolvedCustomerEmail,
        items: invoiceItems,
        deliveryAddress: metadata?.deliveryAddress,
        location: metadata?.location,
      });

      return NextResponse.json({
        success: true,
        status: 'pending',
        message: `Demande envoyée à ${normalizedPhone}. Veuillez confirmer sur votre téléphone.`,
        reference: tx_ref,
        redirectUrl: charge.redirectUrl,
      });
    }

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          message:
            'Paiement Mobile Money indisponible : MOBILE_MONEY_API_KEY (et MOBILE_MONEY_API_URL/MOBILE_MONEY_VERIFY_URL en mode generic) non configurés.',
        },
        { status: 503 }
      );
    }

    // Mode démo (dev/local uniquement, sans prestataire configuré) :
    // confirmation immédiate locale pour pouvoir tester le parcours.
    const result = await confirmPayment({
      reference: tx_ref,
      method: 'mobilemoney',
      amount: parsedAmount,
      currency: parsedCurrency,
      customerName: resolvedCustomerName,
      customerEmail: resolvedCustomerEmail,
      items: invoiceItems,
      deliveryAddress: metadata?.deliveryAddress,
      location: metadata?.location,
    });

    return NextResponse.json({
      success: true,
      transaction_id: `TXN-DEMO-${Date.now()}`,
      status: 'confirmed',
      message: `Paiement simulé confirmé (mode démo, sans prestataire configuré).`,
      reference: tx_ref,
      invoice: result.invoice
        ? { number: result.invoice.number, sent: result.invoice.sent, email: result.invoice.email }
        : null,
    });
  } catch (error) {
    console.error('Erreur paiement Mobile Money:', error);
    return NextResponse.json(
      { message: 'Erreur lors du traitement du paiement' },
      { status: 500 }
    );
  }
}
