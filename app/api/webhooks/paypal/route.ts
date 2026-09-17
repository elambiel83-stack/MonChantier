import { NextRequest, NextResponse } from 'next/server';
import { confirmPayment } from '@/lib/paymentConfirmation';
import { decodeInvoicePayload } from '@/lib/paymentPayloadCodec';
import { decodeWalletDepositPayload } from '@/lib/walletPayloadCodec';
import { confirmDeposit } from '@/lib/walletStore';
import { verifyPayPalWebhookSignature } from '@/lib/paypal';
import { claimWebhookEvent, unclaimWebhookEvent } from '@/lib/paymentStore';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const eventType = String(body.event_type || '');
    const eventId = typeof body.id === 'string' ? body.id : null;

    if (!eventId) {
      return NextResponse.json(
        { message: 'Event PayPal sans identifiant' },
        { status: 400 }
      );
    }

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      return NextResponse.json(
        { message: 'PAYPAL_WEBHOOK_ID manquant' },
        { status: 500 }
      );
    }

    const valid = await verifyPayPalWebhookSignature({
      webhookId,
      body,
      headers: {
        transmissionId: request.headers.get('paypal-transmission-id'),
        transmissionTime: request.headers.get('paypal-transmission-time'),
        transmissionSig: request.headers.get('paypal-transmission-sig'),
        certUrl: request.headers.get('paypal-cert-url'),
        authAlgo: request.headers.get('paypal-auth-algo'),
      },
    });
    if (!valid) {
      return NextResponse.json({ message: 'Signature PayPal invalide' }, { status: 400 });
    }

    // Claim atomique *après* vérification de signature (jamais avant : un
    // appelant non authentifié ne doit pas pouvoir "réserver" un event_id
    // deviné pour bloquer le traitement du vrai webhook). Deux redélivrances
    // concurrentes du même event_id ne peuvent alors pas passer toutes les
    // deux, contrairement à un has()-puis-mark() en deux temps.
    const claimed = await claimWebhookEvent('paypal', eventId);
    if (!claimed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    try {
      if (eventType !== 'CHECKOUT.ORDER.APPROVED' && eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
        return NextResponse.json({ received: true, ignored: true });
      }

      const resource = (body.resource || {}) as Record<string, unknown>;
      const purchaseUnits = Array.isArray(resource.purchase_units)
        ? (resource.purchase_units as Array<Record<string, unknown>>)
        : [];
      const purchaseUnitCustomId =
        purchaseUnits.length > 0 && typeof purchaseUnits[0].custom_id === 'string'
          ? (purchaseUnits[0].custom_id as string)
          : undefined;
      const customId =
        (resource.custom_id as string | undefined) ||
        purchaseUnitCustomId ||
        ((resource.supplementary_data as Record<string, unknown> | undefined)?.custom_id as
          | string
          | undefined) ||
        null;

      const walletPayload = decodeWalletDepositPayload(customId);
      if (walletPayload) {
        const { wallet, alreadyConfirmed } = await confirmDeposit({
          identity: walletPayload.identity,
          reference: walletPayload.reference,
          method: walletPayload.method,
          currency: walletPayload.currency,
          amount: walletPayload.amount,
        });
        return NextResponse.json({ received: true, validated: true, wallet, alreadyConfirmed });
      }

      const invoicePayload = decodeInvoicePayload(customId);
      if (!invoicePayload) {
        await unclaimWebhookEvent('paypal', eventId);
        return NextResponse.json(
          { message: 'custom_id absent ou invalide dans le webhook PayPal' },
          { status: 400 }
        );
      }

      const result = await confirmPayment(invoicePayload);
      return NextResponse.json({ received: true, validated: true, ...result });
    } catch (error) {
      await unclaimWebhookEvent('paypal', eventId);
      throw error;
    }
  } catch (error) {
    console.error('Erreur webhook PayPal:', error);
    return NextResponse.json(
      { message: 'Erreur traitement webhook PayPal' },
      { status: 500 }
    );
  }
}
