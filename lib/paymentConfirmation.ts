import { randomBytes } from 'crypto';
import { recordPayment } from '@/lib/adminStore';
import { buildInvoiceText, createInvoice, InvoicePaymentMethod } from '@/lib/invoice';
import { buildInvoicePdf } from '@/lib/invoicePdf';
import { isMailerConfigured, sendInvoiceEmail } from '@/lib/mailer';
import {
  buildPendingPaymentReconciliation,
  getStoredPaymentStatus,
  PaymentReconciliation,
  setStoredPaymentStatus,
  StoredPaymentStatus,
  StoredInvoice,
} from '@/lib/paymentStore';
import { createDeliveryFromPayment } from '@/lib/deliveryStore';
import { autoLinkDeliveryReferenceToSite, autoLinkOrderReferenceToSite } from '@/lib/siteStore';

export type ConfirmPaymentPayload = {
  reference: string;
  method: InvoicePaymentMethod;
  amount: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  items?: Array<{ productName?: string; quantity?: number; unitPrice?: number }>;
  deliveryAddress?: string;
  location?: { lat?: number; lng?: number } | null;
};

export type PaymentStatus = {
  reference: string;
  state: 'pending' | 'confirmed';
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

function buildSkippedReconciliation(): PaymentReconciliation {
  const updatedAt = new Date().toISOString();
  return {
    delivery: { state: 'skipped', updatedAt, detail: 'Adresse ou identité client manquante' },
    orderLink: { state: 'skipped', updatedAt, detail: 'Adresse ou identité client manquante' },
    deliveryLink: { state: 'skipped', updatedAt, detail: 'Adresse ou identité client manquante' },
  };
}

function isReconciliationComplete(status: StoredPaymentStatus | null) {
  const reconciliation = status?.reconciliation;
  if (!reconciliation) return false;
  return [reconciliation.delivery, reconciliation.orderLink, reconciliation.deliveryLink].every(
    (step) => step.state === 'completed' || step.state === 'skipped'
  );
}

function updateReconciliationStep(status: StoredPaymentStatus, step: 'delivery' | 'orderLink' | 'deliveryLink', patch: {
  state: 'pending' | 'completed' | 'failed' | 'skipped';
  reference?: string;
  siteId?: string;
  detail?: string;
}) {
  const current = status.reconciliation || buildPendingPaymentReconciliation();
  status.reconciliation = {
    ...current,
    [step]: {
      ...current[step],
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  };
}

async function synchronizePaymentArtifacts(
  status: StoredPaymentStatus,
  invoice: ConfirmPaymentPayload & { customerEmail?: string; customerName?: string; deliveryAddress?: string; location?: { lat?: number; lng?: number } | null }
) {
  if (!invoice.deliveryAddress || !invoice.customerEmail) {
    status.reconciliation = buildSkippedReconciliation();
    status.updatedAt = new Date().toISOString();
    await setStoredPaymentStatus(status);
    return status;
  }

  if (!status.reconciliation) {
    status.reconciliation = buildPendingPaymentReconciliation();
  }

  let deliveryReference = status.reconciliation.delivery.reference;

  try {
    const delivery = await createDeliveryFromPayment({
      reference: status.reference,
      clientIdentity: invoice.customerEmail,
      clientName: invoice.customerName || 'Client MonChantier',
      deliveryAddress: invoice.deliveryAddress,
      location: invoice.location,
    });
    deliveryReference = delivery.reference;
    updateReconciliationStep(status, 'delivery', {
      state: 'completed',
      reference: delivery.reference,
      detail: 'Livraison créée ou retrouvée',
    });
    await setStoredPaymentStatus(status);

    const linkedDeliverySite = await autoLinkDeliveryReferenceToSite({
      reference: delivery.reference,
      clientIdentity: delivery.clientIdentity,
      deliveryAddress: delivery.deliveryAddress,
    });
    updateReconciliationStep(status, 'deliveryLink', linkedDeliverySite
      ? { state: 'completed', siteId: linkedDeliverySite.id, detail: 'Livraison reliée au chantier' }
      : { state: 'skipped', detail: 'Aucun chantier correspondant pour la livraison' });
    await setStoredPaymentStatus(status);
  } catch (error) {
    updateReconciliationStep(status, 'delivery', {
      state: 'failed',
      reference: deliveryReference,
      detail: error instanceof Error ? error.message : 'Erreur création livraison',
    });
    status.updatedAt = new Date().toISOString();
    await setStoredPaymentStatus(status);
    throw error;
  }

  try {
    const linkedOrderSite = await autoLinkOrderReferenceToSite({
      reference: status.reference,
      clientIdentity: invoice.customerEmail,
      deliveryAddress: invoice.deliveryAddress,
    });
    updateReconciliationStep(status, 'orderLink', linkedOrderSite
      ? { state: 'completed', siteId: linkedOrderSite.id, detail: 'Commande reliée au chantier' }
      : { state: 'skipped', detail: 'Aucun chantier correspondant pour la commande' });
    status.updatedAt = new Date().toISOString();
    await setStoredPaymentStatus(status);
    return status;
  } catch (error) {
    updateReconciliationStep(status, 'orderLink', {
      state: 'failed',
      detail: error instanceof Error ? error.message : 'Erreur liaison commande/chantier',
    });
    status.updatedAt = new Date().toISOString();
    await setStoredPaymentStatus(status);
    throw error;
  }
}

export async function registerPendingPayment(reference: string, method: InvoicePaymentMethod) {
  await setStoredPaymentStatus({
    reference,
    method,
    state: 'pending',
    updatedAt: new Date().toISOString(),
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

  const existingStatus = await getStoredPaymentStatus(payload.reference);
  if (existingStatus?.state === 'confirmed' && existingStatus.invoice) {
    if (
      existingStatus.fullInvoice &&
      !isReconciliationComplete(existingStatus)
    ) {
      await synchronizePaymentArtifacts(existingStatus, existingStatus.fullInvoice);
    }
    return {
      success: true,
      alreadyConfirmed: true,
      invoice: existingStatus.invoice,
    };
  }

  recordPayment({
    method: payload.method,
    amount: parsedAmount,
    currency: sanitizeCurrency(payload.currency),
    reference: payload.reference,
  });

  const invoice = createInvoice({
    reference: payload.reference,
    customerName: (payload.customerName || 'Client MonChantier').trim(),
    customerEmail: (payload.customerEmail || '').trim(),
    method: payload.method,
    amount: parsedAmount,
    currency: sanitizeCurrency(payload.currency),
    items: (Array.isArray(payload.items) ? payload.items : []).map((item) => ({
      productName: item.productName || 'Produit',
      quantity: Number(item.quantity || 1),
      unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : undefined,
    })),
    deliveryAddress: payload.deliveryAddress,
    location: payload.location,
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
    reconciliation:
      invoice.deliveryAddress && invoice.customerEmail
        ? buildPendingPaymentReconciliation()
        : buildSkippedReconciliation(),
  });

  const confirmedStatus = await getStoredPaymentStatus(payload.reference);
  if (confirmedStatus) {
    await synchronizePaymentArtifacts(confirmedStatus, invoice);
  }

  return {
    success: true,
    alreadyConfirmed: false,
    invoice: invoiceResponse,
  };
}
