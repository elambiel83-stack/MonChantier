import { NextRequest, NextResponse } from 'next/server';
import { recordPayment } from '@/lib/adminStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, currency, phone, network, fullname, email, tx_ref, metadata } = body;

    const items = Array.isArray(metadata?.items) ? metadata.items : [];
    const totalQty = items.reduce(
      (sum: number, item: { quantity?: number }) => sum + Number(item?.quantity || 0),
      0
    );
    const productSummary = items
      .map((item: { productName?: string; quantity?: number }) => `${item.productName || 'Produit'} x${item.quantity || 1}`)
      .join(', ');

    // Validation
    if (!amount || !phone || !network || !tx_ref) {
      return NextResponse.json(
        { message: 'Montant, téléphone, réseau et référence requis' },
        { status: 400 }
      );
    }

    // Normaliser le numéro de téléphone
    const normalizedPhone = phone.replace(/\s+/g, '');

    // En production: intégration Klasha, Flutterwave ou autre
    console.log('=== DEMANDE DE PAIEMENT MOBILE MONEY ===');
    console.log('Montant:', amount, currency);
    console.log('Téléphone:', normalizedPhone);
    console.log('Réseau:', network);
    console.log('Client:', fullname, email);
    console.log('Référence:', tx_ref);
    console.log('Articles:', items);
    console.log('Résumé:', productSummary);
    console.log('Quantité totale:', totalQty);
    console.log('Adresse livraison:', metadata?.deliveryAddress);
    console.log('Localisation:', metadata?.location);
    console.log('=======================================');

    // Simuler un délai de traitement
    await new Promise(resolve => setTimeout(resolve, 1000));

    recordPayment({
      method: 'mobilemoney',
      amount: Number(amount),
      currency,
      reference: tx_ref,
    });

    // Simuler une réponse de succès
    return NextResponse.json({ 
      success: true,
      transaction_id: `TXN-${Date.now()}`,
      status: 'pending',
      message: `Demande envoyée à ${normalizedPhone}. Veuillez confirmer sur votre téléphone.`,
      reference: tx_ref
    });
  } catch (error) {
    console.error('Erreur paiement Mobile Money:', error);
    return NextResponse.json(
      { message: 'Erreur lors du traitement du paiement' },
      { status: 500 }
    );
  }
}
