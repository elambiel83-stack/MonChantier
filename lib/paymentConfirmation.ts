import { randomBytes } from 'crypto';
import { recordPayment } from '@/lib/adminStore';
import { buildInvoiceText, createInvoice, InvoicePaymentMethod } from '@/lib/invoice';
import { buildInvoicePdf } from '@/lib/invoicePdf';
import { isMailerConfigured, sendInvoiceEmail } from '@/lib/mailer';
import {
  claimPaymentConfirmation,
  getStoredPaymentStatus,
  releasePaymentClaim,
  setStoredPaymentStatus,
  StoredInvoice,
} from '@/lib/paymentStore';
import { createDeliveryFromPayment } from '@/lib/deliveryStore';
import { decrementStock } from '@/lib/productStore';

export type ConfirmPaymentPayload = {
  reference: string;
  method: InvoicePaymentMethod;
  amount: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  items?: Array<{ productId?: number; productName?: string; quantity?: number; unitPrice?: number }>;
  deliveryAddress?: string;
  location?: { lat?: number; lng?: number } | null;
};

export type PaymentStatus = {
  reference: string;
  state: 'pending' | 'confirming' | 'confirmed';
  method: InvoicePaymentMethod;
  updatedAt: string;
  invoice?: StoredInvoice;
};

function sanitizeCurrency(value: unknown) {
  if (typeof value !== 'string') return 'CDF';
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3,5}$/.test(normalized) ? normalized : 'CDF';
}

function parsePositiveAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function isSupportedMethod(value: unknown): value is InvoicePaymentMethod {
  return value === 'mobilemoney' || value === 'card' || value === 'paypal';
}

/**
 * References are looked up unauthenticated (see /api/payments/status), so they
 * double as bearer tokens: a timestamp alone is guessable/enumerable, hence the
 * random suffix.
 */
export function generatePaymentReference(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(9).toString('base64url')}`;
}

export async function registerPendingPayment(
  reference: string,
  method: InvoicePaymentMethod,
  pendingPayload?: ConfirmPaymentPayload
) {
  await setStoredPaymentStatus({
    reference,
    method,
    state: 'pending',
    updatedAt: new Date().toISOString(),
    pendingPayload: pendingPayload as unknown as Record<string, unknown> | undefined,
  });
}

export async function getPaymentStatus(reference: string) {
  const status = await getStoredPaymentStatus(reference);
  return status || null;
}

export async function confirmPayment(payload: ConfirmPaymentPayload) {
  if (!payload?.reference || !isSupportedMethod(payload.method)) {
    throw new Error('Référence et méthode de paiement valides sont requises');
  }

  const parsedAmount = parsePositiveAmount(payload.amount);
  if (!parsedAmount) {
    throw new Error('Montant invalide pour confirmation de paiement');
  }

  // Réservation atomique : si un autre appel (webhook redélivré, double
  // clic) a déjà confirmé — ou est en train de confirmer — cette référence,
  // on ne refait pas le travail (facture, email) une deuxième fois.
  const claim = await claimPaymentConfirmation(payload.reference, payload.method);
  if (claim.outcome === 'already_confirmed') {
    return {
      success: true,
      alreadyConfirmed: true,
      invoice: claim.status.invoice,
    };
  }
  if (claim.outcome === 'in_progress') {
    return {
      success: true,
      alreadyConfirmed: false,
      inProgress: true,
      invoice: undefined,
    };
  }

  try {
    const items = (Array.isArray(payload.items) ? payload.items : []).map((item) => ({
      productId: typeof item.productId === 'number' ? item.productId : undefined,
      productName: item.productName || 'Produit',
      quantity: Number(item.quantity || 1),
      unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : undefined,
    }));

    // Décrément atomique du stock pour les articles qui référencent un vrai
    // produit du catalogue (stock non suivi = ignoré, voir decrementStock).
    // L'argent étant déjà encaissé à ce stade (webhook provider), une
    // rupture ne bloque pas la facture — elle est journalisée pour un
    // traitement manuel plutôt que de survendre en silence.
    const stockItems = items
      .filter((item) => item.productId !== undefined)
      .map((item) => ({ productId: item.productId!, quantity: item.quantity }));
    let stockShortfall: Awaited<ReturnType<typeof decrementStock>> | null = null;
    if (stockItems.length > 0) {
      stockShortfall = await decrementStock(stockItems);
      if (!stockShortfall.success) {
        console.error(
          `Rupture de stock à la confirmation du paiement ${payload.reference}:`,
          stockShortfall.shortfalls
        );
      }
    }

    const invoice = createInvoice({
      reference: payload.reference,
      customerName: (payload.customerName || 'Client MonChantier').trim(),
      customerEmail: (payload.customerEmail || '').trim(),
      method: payload.method,
      amount: parsedAmount,
      currency: sanitizeCurrency(payload.currency),
      items,
      deliveryAddress: payload.deliveryAddress,
      location: payload.location,
    });

    await recordPayment({
      method: payload.method,
      amount: parsedAmount,
      currency: sanitizeCurrency(payload.currency),
      reference: payload.reference,
    });

    let invoiceSent = false;
    if (invoice.customerEmail && isMailerConfigured()) {
      try {
        const invoicePdf = await buildInvoicePdf(invoice);
        await sendInvoiceEmail({
          to: invoice.customerEmail,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          text: buildInvoiceText(invoice),
          pdf: invoicePdf,
        });
        invoiceSent = true;
      } catch (mailError) {
        console.error('Erreur envoi facture à la confirmation:', mailError);
      }
    }

    const invoiceResponse = {
      standard: invoice.standard,
      legalReference: invoice.legalReference,
      number: invoice.invoiceNumber,
      sent: invoiceSent,
      email: invoice.customerEmail || null,
      taxRate: invoice.taxRate,
      totals: {
        ht: invoice.totalHT,
        tva: invoice.totalTVA,
        ttc: invoice.totalTTC,
        currency: invoice.currency,
      },
    };

    await setStoredPaymentStatus({
      reference: payload.reference,
      method: payload.method,
      state: 'confirmed',
      updatedAt: new Date().toISOString(),
      invoice: invoiceResponse,
      fullInvoice: invoice,
      orderStatus: 'processing',
    });

    if (invoice.deliveryAddress && invoice.customerEmail) {
      await createDeliveryFromPayment({
        reference: payload.reference,
        clientIdentity: invoice.customerEmail,
        clientName: invoice.customerName,
        deliveryAddress: invoice.deliveryAddress,
        location: invoice.location,
      });
    }

    return {
      success: true,
      alreadyConfirmed: false,
      invoice: invoiceResponse,
      stockShortfall: stockShortfall && !stockShortfall.success ? stockShortfall.shortfalls : undefined,
    };
  } catch (error) {
    // Le paiement reste "confirming" sinon : on repasse en "pending" pour
    // qu'une nouvelle tentative (retry webhook, admin) soit possible plutôt
    // que de bloquer définitivement cette référence.
    await releasePaymentClaim(payload.reference);
    throw error;
  }
}
