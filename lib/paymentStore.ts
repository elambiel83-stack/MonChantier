import { promises as fs } from 'fs';
import path from 'path';
import { InvoiceData, InvoicePaymentMethod } from '@/lib/invoice';

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

const STORE_PATH = path.join(process.cwd(), 'data', 'payment-webhook-store.json');
const MAX_WEBHOOK_EVENT_IDS = 5000;

const INITIAL_STORE: PaymentStoreModel = {
  paymentStatuses: {},
  processedWebhookEvents: {
    stripe: [],
    paypal: [],
  },
};

let storeMutex: Promise<void> = Promise.resolve();

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(INITIAL_STORE, null, 2), 'utf8');
  }
}

async function readStore(): Promise<PaymentStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');

  try {
    const parsed = JSON.parse(raw) as Partial<PaymentStoreModel>;
    return {
      paymentStatuses: parsed.paymentStatuses || {},
      processedWebhookEvents: {
        stripe: parsed.processedWebhookEvents?.stripe || [],
        paypal: parsed.processedWebhookEvents?.paypal || [],
      },
    };
  } catch {
    return INITIAL_STORE;
  }
}

async function writeStore(store: PaymentStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function getStoredPaymentStatus(reference: string): Promise<StoredPaymentStatus | null> {
  return withLock(async () => {
    const store = await readStore();
    return store.paymentStatuses[reference] || null;
  });
}

export function setStoredPaymentStatus(status: StoredPaymentStatus): Promise<void> {
  return withLock(async () => {
    const store = await readStore();
    store.paymentStatuses[status.reference] = status;
    await writeStore(store);
  });
}

export function listPaymentStatuses(): Promise<StoredPaymentStatus[]> {
  return withLock(async () => {
    const store = await readStore();
    return Object.values(store.paymentStatuses);
  });
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
  return withLock(async () => {
    const store = await readStore();
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

    await writeStore(store);
    return { status: existing };
  });
}

export function hasProcessedWebhookEvent(
  provider: WebhookProvider,
  eventId: string
): Promise<boolean> {
  return withLock(async () => {
    const store = await readStore();
    return store.processedWebhookEvents[provider].includes(eventId);
  });
}

export function markWebhookEventProcessed(
  provider: WebhookProvider,
  eventId: string
): Promise<void> {
  return withLock(async () => {
    const store = await readStore();
    const events = store.processedWebhookEvents[provider];

    if (!events.includes(eventId)) {
      events.push(eventId);
      if (events.length > MAX_WEBHOOK_EVENT_IDS) {
        events.splice(0, events.length - MAX_WEBHOOK_EVENT_IDS);
      }
      await writeStore(store);
    }
  });
}
