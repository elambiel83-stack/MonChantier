import { InvoiceData, InvoicePaymentMethod } from '@/lib/invoice';
import { readStore, withStore } from './storeDb';

export type StoredInvoice = {
  number: string;
  sent: boolean;
  email: string | null;
  standard: string;
  legalReference: string;
  taxRate: number;
  totals: {
    ht: number;
    tva: number;
    ttc: number;
    currency: string;
  };
};

// Cycle de traitement de la commande, distinct de `state` (qui reflète l'état
// du paiement). Une commande passe en "processing" dès confirmation du
// paiement, puis suit le traitement logistique jusqu'à livraison ou annulation.
export type OrderStatus = 'processing' | 'shipped' | 'delivered' | 'cancelled';

// 'confirming' est un état transitoire posé atomiquement par
// claimPaymentConfirmation() pendant la génération de la facture (opération
// lente : PDF, email) : il empêche un deuxième appel concurrent (webhook
// redélivré, double clic) de refaire le travail et d'émettre une deuxième
// facture pour la même référence.
export type StoredPaymentStatus = {
  reference: string;
  state: 'pending' | 'confirming' | 'confirmed';
  method: InvoicePaymentMethod;
  updatedAt: string;
  invoice?: StoredInvoice;
  // Snapshot complet de la facture (articles, vendeur, client) permettant de
  // régénérer le PDF plus tard (le résumé `invoice` ci-dessus ne suffit pas).
  fullInvoice?: InvoiceData;
  orderStatus?: OrderStatus;
  cancelReason?: string;
  // Charge complète nécessaire pour finaliser la confirmation une fois le
  // paiement vérifié auprès du prestataire (ex: Mobile Money, où l'appel
  // /initiate ne confirme rien lui-même — voir /api/payments/mobilemoney/check).
  pendingPayload?: Record<string, unknown>;
};

type WebhookProvider = 'stripe' | 'paypal';

type PaymentStoreModel = {
  paymentStatuses: Record<string, StoredPaymentStatus>;
  processedWebhookEvents: {
    stripe: string[];
    paypal: string[];
  };
};

const STORE_KEY = 'payment-webhook-store';
const MAX_WEBHOOK_EVENT_IDS = 5000;

const buildInitialStore = (): PaymentStoreModel => ({
  paymentStatuses: {},
  processedWebhookEvents: {
    stripe: [],
    paypal: [],
  },
});

export async function getStoredPaymentStatus(reference: string): Promise<StoredPaymentStatus | null> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.paymentStatuses[reference] || null;
}

export function setStoredPaymentStatus(status: StoredPaymentStatus): Promise<void> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    store.paymentStatuses[status.reference] = status;
  });
}

export async function listPaymentStatuses(): Promise<StoredPaymentStatus[]> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return Object.values(store.paymentStatuses);
}

const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function updateOrderStatus(
  reference: string,
  nextStatus: OrderStatus,
  cancelReason?: string
): Promise<{ status: StoredPaymentStatus } | { error: string }> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const existing = store.paymentStatuses[reference];
    if (!existing || existing.state !== 'confirmed') {
      return { error: 'Commande introuvable ou non confirmée' };
    }

    const current = existing.orderStatus || 'processing';
    if (current !== nextStatus && !ORDER_STATUS_TRANSITIONS[current].includes(nextStatus)) {
      return { error: `Transition invalide: ${current} → ${nextStatus}` };
    }

    existing.orderStatus = nextStatus;
    existing.updatedAt = new Date().toISOString();
    if (nextStatus === 'cancelled' && cancelReason) {
      existing.cancelReason = cancelReason;
    }

    return { status: existing };
  });
}

export async function hasProcessedWebhookEvent(
  provider: WebhookProvider,
  eventId: string
): Promise<boolean> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.processedWebhookEvents[provider].includes(eventId);
}

export function markWebhookEventProcessed(
  provider: WebhookProvider,
  eventId: string
): Promise<void> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const events = store.processedWebhookEvents[provider];
    if (!events.includes(eventId)) {
      events.push(eventId);
      if (events.length > MAX_WEBHOOK_EVENT_IDS) {
        events.splice(0, events.length - MAX_WEBHOOK_EVENT_IDS);
      }
    }
  });
}

/**
 * Combine has+mark en une seule opération atomique : deux webhooks
 * concurrents portant le même event_id (Stripe/PayPal redélivrent
 * réellement) ne doivent pas tous les deux passer le test — un seul doit
 * "gagner" le droit de traiter l'événement. Marque tout de suite (avant le
 * traitement, qui peut être lent) : en cas d'échec du traitement, appeler
 * unclaimWebhookEvent() pour permettre une nouvelle tentative légitime du
 * provider plutôt que de perdre l'événement silencieusement pour toujours.
 */
export function claimWebhookEvent(provider: WebhookProvider, eventId: string): Promise<boolean> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const events = store.processedWebhookEvents[provider];
    if (events.includes(eventId)) return false;
    events.push(eventId);
    if (events.length > MAX_WEBHOOK_EVENT_IDS) {
      events.splice(0, events.length - MAX_WEBHOOK_EVENT_IDS);
    }
    return true;
  });
}

/** Voir claimWebhookEvent() : à appeler si le traitement échoue après le claim. */
export function unclaimWebhookEvent(provider: WebhookProvider, eventId: string): Promise<void> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const events = store.processedWebhookEvents[provider];
    const index = events.indexOf(eventId);
    if (index !== -1) events.splice(index, 1);
  });
}

export type ClaimPaymentConfirmationResult =
  | { outcome: 'claimed' }
  | { outcome: 'already_confirmed'; status: StoredPaymentStatus }
  | { outcome: 'in_progress' };

/**
 * Réserve atomiquement le droit de confirmer un paiement : pose l'état
 * 'confirming' avant que l'appelant ne fasse le travail lent (génération de
 * facture, envoi d'email). Un deuxième appel concurrent pour la même
 * référence (webhook redélivré, double clic) obtient 'in_progress' ou
 * 'already_confirmed' au lieu de refaire tout le travail — ce qui évite les
 * factures et emails en double. Voir releasePaymentClaim() pour l'échec.
 */
export function claimPaymentConfirmation(
  reference: string,
  method: InvoicePaymentMethod
): Promise<ClaimPaymentConfirmationResult> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const existing = store.paymentStatuses[reference];
    if (existing?.state === 'confirmed') {
      return { outcome: 'already_confirmed' as const, status: existing };
    }
    if (existing?.state === 'confirming') {
      return { outcome: 'in_progress' as const };
    }
    store.paymentStatuses[reference] = {
      reference,
      method,
      state: 'confirming',
      updatedAt: new Date().toISOString(),
    };
    return { outcome: 'claimed' as const };
  });
}

/**
 * À appeler si la génération de facture échoue après claimPaymentConfirmation :
 * remet 'pending' pour qu'une nouvelle tentative (webhook retry, admin) soit
 * possible, plutôt que de laisser la référence bloquée en 'confirming' pour
 * toujours.
 */
export function releasePaymentClaim(reference: string): Promise<void> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const existing = store.paymentStatuses[reference];
    if (existing?.state === 'confirming') {
      existing.state = 'pending';
      existing.updatedAt = new Date().toISOString();
    }
  });
}
