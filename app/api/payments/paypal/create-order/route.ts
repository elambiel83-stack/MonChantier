import { NextRequest, NextResponse } from 'next/server';
import { recordPayment } from '@/lib/adminStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, currency, items, deliveryAddress, location, returnUrl, cancelUrl } = body;

    const normalizedItems = Array.isArray(items) ? items : [];
    const totalQty = normalizedItems.reduce(
      (sum: number, item: { quantity?: number }) => sum + Number(item?.quantity || 0),
      0
    );
    const productSummary = normalizedItems
      .map((item: { productName?: string; quantity?: number }) => `${item.productName || 'Produit'} x${item.quantity || 1}`)
      .join(', ');

    // Validation
    if (!amount || !returnUrl || !cancelUrl || normalizedItems.length === 0) {
      return NextResponse.json(
        { message: 'Montant, URLs de redirection et articles requis' },
        { status: 400 }
      );
    }

    // En production: utiliser PayPal SDK
    console.log('=== CRÉATION COMMANDE PAYPAL ===');
    console.log('Montant:', amount, currency);
    console.log('Articles:', normalizedItems);
    console.log('Résumé:', productSummary);
    console.log('Quantité totale:', totalQty);
    console.log('Adresse livraison:', deliveryAddress);
    console.log('Localisation:', location);
    console.log('Return URL:', returnUrl);
    console.log('Cancel URL:', cancelUrl);
    console.log('================================');

    // Simuler la création d'une commande PayPal
    await new Promise(resolve => setTimeout(resolve, 500));

    recordPayment({
      method: 'paypal',
      amount: Number(amount),
      currency,
      reference: `PAYPAL-${Date.now()}`,
    });

    // En production: retourner l'URL d'approbation PayPal réelle
    // Pour la démo, on simule avec une page locale
    return NextResponse.json({ 
      success: true,
      approveUrl: `${returnUrl}?paypal_order_id=demo_${Date.now()}&amount=${amount}&items=${encodeURIComponent(productSummary)}`,
      orderId: `PAYPAL-${Date.now()}`
    });
  } catch (error) {
    console.error('Erreur création commande PayPal:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la création de la commande PayPal' },
      { status: 500 }
    );
  }
}
