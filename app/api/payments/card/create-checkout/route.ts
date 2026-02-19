import { NextRequest, NextResponse } from 'next/server';
import { recordPayment } from '@/lib/adminStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, currency, items, deliveryAddress, location, successUrl, cancelUrl } = body;

    const normalizedItems = Array.isArray(items) ? items : [];
    const totalQty = normalizedItems.reduce(
      (sum: number, item: { quantity?: number }) => sum + Number(item?.quantity || 0),
      0
    );
    const productSummary = normalizedItems
      .map((item: { productName?: string; quantity?: number }) => `${item.productName || 'Produit'} x${item.quantity || 1}`)
      .join(', ');

    // Validation
    if (!amount || !successUrl || !cancelUrl || normalizedItems.length === 0) {
      return NextResponse.json(
        { message: 'Montant, URLs de redirection et articles requis' },
        { status: 400 }
      );
    }

    // En production: utiliser Stripe, Paystack ou autre
    console.log('=== CRÉATION CHECKOUT CARTE BANCAIRE ===');
    console.log('Montant:', amount, currency);
    console.log('Articles:', normalizedItems);
    console.log('Résumé:', productSummary);
    console.log('Quantité totale:', totalQty);
    console.log('Adresse livraison:', deliveryAddress);
    console.log('Localisation:', location);
    console.log('Success URL:', successUrl);
    console.log('Cancel URL:', cancelUrl);
    console.log('========================================');

    // Simuler la création d'une session Stripe
    await new Promise(resolve => setTimeout(resolve, 500));

    recordPayment({
      method: 'card',
      amount: Number(amount),
      currency,
      reference: `cs_demo_${Date.now()}`,
    });

    // En production: retourner l'URL de checkout Stripe réel
    // Pour la démo, on simule avec une page locale
    return NextResponse.json({ 
      success: true,
      checkoutUrl: `${successUrl}?session_id=demo_${Date.now()}&amount=${amount}&items=${encodeURIComponent(productSummary)}`,
      sessionId: `cs_demo_${Date.now()}`
    });
  } catch (error) {
    console.error('Erreur création checkout:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la création du checkout' },
      { status: 500 }
    );
  }
}
