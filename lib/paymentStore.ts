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

export type StoredPaymentStatus = {
  reference: string;
  state: 'pending' | 'confirmed';
  method: InvoicePaymentMethod;
  updatedAt: string;
  invoice?: StoredInvoice;
  // Snapshot complet de la facture (articles, vendeur, client) permettant de
  // régénérer le PDF plus tard (le résumé `invoice` ci-dessus ne suffit pas).
  fullInvoice?: InvoiceData;
  orderStatus?: OrderStatus;
  cancelReason?: string;
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
