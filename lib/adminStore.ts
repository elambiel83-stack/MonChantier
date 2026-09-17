import type { AppRole } from '@/lib/roles';
import { readStore, withStore } from './storeDb';

export type AdminEvent = {
  id: string;
  kind: 'contact' | 'partner' | 'payment' | 'user';
  label: string;
  labelFr?: string;
  labelEn?: string;
  details?: string;
  detailsFr?: string;
  detailsEn?: string;
  method?: 'mobilemoney' | 'card' | 'paypal';
  amount?: number;
  currency?: string;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  active: boolean;
  createdAt: string;
};

type AdminStoreState = {
  contacts: number;
  partners: number;
  payments: number;
  mobileMoneyPayments: number;
  cardPayments: number;
  paypalPayments: number;
  events: AdminEvent[];
  users: AdminUser[];
};

const STORE_KEY = 'admin-store';
const MAX_EVENTS = 100;

function buildInitialStore(): AdminStoreState {
  return {
    contacts: 0,
    partners: 0,
    payments: 0,
    mobileMoneyPayments: 0,
    cardPayments: 0,
    paypalPayments: 0,
    events: [],
    users: [
      {
        id: 'user-admin-1',
        name: 'Admin MonChantier',
        email: 'admin@monchantier.cd',
        role: 'admin',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function pushEvent(store: AdminStoreState, event: Omit<AdminEvent, 'id' | 'createdAt'>) {
  const item: AdminEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...event,
  };
  store.events.unshift(item);
  if (store.events.length > MAX_EVENTS) {
    store.events.length = MAX_EVENTS;
  }
}

export function recordContact(payload: { name?: string; email?: string }): Promise<void> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    store.contacts += 1;
    const labelFr = payload.name ? `Nouveau message: ${payload.name}` : 'Nouveau message';
    const labelEn = payload.name ? `New message: ${payload.name}` : 'New message';
    pushEvent(store, {
      kind: 'contact',
      label: labelFr,
      labelFr,
      labelEn,
      details: payload.email,
      detailsFr: payload.email,
      detailsEn: payload.email,
    });
  });
}

export function recordPartner(payload: {
  type?: string;
  company?: string;
  fullname?: string;
}): Promise<void> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    store.partners += 1;
    const labelFr = payload.company
      ? `Nouveau partenaire: ${payload.company}`
      : 'Nouveau partenaire';
    const labelEn = payload.company
      ? `New partner: ${payload.company}`
      : 'New partner';
    const detailsFr = payload.fullname
      ? `${payload.type || 'partenaire'} • ${payload.fullname}`
      : payload.type;
    const detailsEn = payload.fullname
      ? `${payload.type || 'partner'} • ${payload.fullname}`
      : payload.type;
    pushEvent(store, {
      kind: 'partner',
      label: labelFr,
      labelFr,
      labelEn,
      details: detailsFr,
      detailsFr,
      detailsEn,
    });
  });
}

export function recordPayment(payload: {
  method: 'mobilemoney' | 'card' | 'paypal';
  amount?: number;
  currency?: string;
  reference?: string;
}): Promise<void> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    store.payments += 1;

    if (payload.method === 'mobilemoney') {
      store.mobileMoneyPayments += 1;
    } else if (payload.method === 'card') {
      store.cardPayments += 1;
    } else if (payload.method === 'paypal') {
      store.paypalPayments += 1;
    }

    const methodFrMap: Record<'mobilemoney' | 'card' | 'paypal', string> = {
      mobilemoney: 'mobilemoney',
      card: 'carte',
      paypal: 'paypal',
    };

    pushEvent(store, {
      kind: 'payment',
      method: payload.method,
      amount: payload.amount,
      currency: payload.currency,
      label: `Paiement ${payload.method}`,
      labelFr: `Paiement ${methodFrMap[payload.method]}`,
      labelEn: `Payment ${payload.method}`,
      details: payload.reference,
      detailsFr: payload.reference,
      detailsEn: payload.reference,
    });
  });
}

export async function getAdminStats() {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return {
    summary: {
      contacts: store.contacts,
      partners: store.partners,
      payments: store.payments,
      users: store.users.length,
      activeUsers: store.users.filter((user) => user.active).length,
      mobileMoneyPayments: store.mobileMoneyPayments,
      cardPayments: store.cardPayments,
      paypalPayments: store.paypalPayments,
    },
    recent: store.events.slice(0, 10),
    generatedAt: new Date().toISOString(),
  };
}

export async function listUsers(): Promise<AdminUser[]> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.users;
}

export function addUser(payload: {
  name: string;
  email: string;
  role: AppRole;
}): Promise<AdminUser> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const user: AdminUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      active: true,
      createdAt: new Date().toISOString(),
    };
    store.users.unshift(user);

    pushEvent(store, {
      kind: 'user',
      label: `Utilisateur ajouté: ${user.name}`,
      labelFr: `Utilisateur ajouté: ${user.name}`,
      labelEn: `User added: ${user.name}`,
      details: `${user.role} • ${user.email}`,
      detailsFr: `${user.role} • ${user.email}`,
      detailsEn: `${user.role} • ${user.email}`,
    });

    return user;
  });
}

export function toggleUserActive(userId: string): Promise<AdminUser | null> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user) return null;

    user.active = !user.active;

    pushEvent(store, {
      kind: 'user',
      label: user.active
        ? `Utilisateur activé: ${user.name}`
        : `Utilisateur désactivé: ${user.name}`,
      labelFr: user.active
        ? `Utilisateur activé: ${user.name}`
        : `Utilisateur désactivé: ${user.name}`,
      labelEn: user.active
        ? `User enabled: ${user.name}`
        : `User disabled: ${user.name}`,
      details: user.email,
      detailsFr: user.email,
      detailsEn: user.email,
    });

    return user;
  });
}
