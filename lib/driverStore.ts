import { promises as fs } from 'fs';
import path from 'path';

export type DriverVehicle = {
  label: string;
  plateNumber: string;
  capacity?: string;
};

export type DriverDocument = {
  id: string;
  name: string;
  url: string;
  category: string;
  createdAt: string;
};

export type DriverEarning = {
  id: string;
  deliveryId: string;
  reference: string;
  amount: number;
  currency: 'USD' | 'CDF';
  createdAt: string;
};

export type DriverProfile = {
  identity: string;
  vehicle: DriverVehicle | null;
  documents: DriverDocument[];
  earnings: DriverEarning[];
  defaultEarningAmount: number | null;
  defaultEarningCurrency: 'USD' | 'CDF';
  updatedAt: string;
};

type DriverStoreModel = {
  profiles: Record<string, DriverProfile>;
};

const STORE_PATH = path.join(process.cwd(), 'data', 'driver-store.json');
const INITIAL_STORE: DriverStoreModel = { profiles: {} };
let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function normalizeIdentity(identity: string) {
  return identity.trim().toLowerCase();
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyProfile(identity: string): DriverProfile {
  return {
    identity,
    vehicle: null,
    documents: [],
    earnings: [],
    defaultEarningAmount: null,
    defaultEarningCurrency: 'USD',
    updatedAt: new Date().toISOString(),
  };
}

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(INITIAL_STORE, null, 2), 'utf8');
  }
}

async function readStore(): Promise<DriverStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<DriverStoreModel>;
    return {
      profiles:
        parsed.profiles && typeof parsed.profiles === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.profiles).map(([identity, profile]) => {
                const dedupedEarnings = new Map<string, DriverEarning>();
                for (const earning of Array.isArray(profile?.earnings) ? profile.earnings : []) {
                  if (!earning || typeof earning !== 'object') continue;
                  const deliveryId = String(earning.deliveryId || '').trim();
                  if (!deliveryId || dedupedEarnings.has(deliveryId)) continue;
                  dedupedEarnings.set(deliveryId, {
                    id: String(earning.id || makeId('DRV-EARN')),
                    deliveryId,
                    reference: String(earning.reference || '').trim(),
                    amount: Number(earning.amount) || 0,
                    currency: earning.currency === 'CDF' ? 'CDF' : 'USD',
                    createdAt: String(earning.createdAt || new Date().toISOString()),
                  });
                }

                return [
                  identity,
                  {
                    identity,
                    vehicle: profile?.vehicle || null,
                    documents: Array.isArray(profile?.documents) ? profile.documents : [],
                    earnings: Array.from(dedupedEarnings.values()),
                    defaultEarningAmount:
                      typeof profile?.defaultEarningAmount === 'number' && Number.isFinite(profile.defaultEarningAmount)
                        ? profile.defaultEarningAmount
                        : null,
                    defaultEarningCurrency: profile?.defaultEarningCurrency === 'CDF' ? 'CDF' : 'USD',
                    updatedAt: String(profile?.updatedAt || new Date().toISOString()),
                  },
                ];
              })
            )
          : {},
    };
  } catch {
    return INITIAL_STORE;
  }
}

async function writeStore(store: DriverStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export function getDriverProfile(identity: string): Promise<DriverProfile> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    return store.profiles[normalized] || emptyProfile(normalized);
  });
}

export function updateDriverProfile(
  identity: string,
  patch: Partial<Pick<DriverProfile, 'vehicle' | 'documents' | 'defaultEarningAmount' | 'defaultEarningCurrency'>>
): Promise<DriverProfile> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const existing = store.profiles[normalized] || emptyProfile(normalized);
    const next: DriverProfile = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    store.profiles[normalized] = next;
    await writeStore(store);
    return next;
  });
}

export function addDriverDocument(identity: string, input: { name: string; url: string; category: string }): Promise<DriverProfile> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const profile = store.profiles[normalized] || emptyProfile(normalized);
    profile.documents.unshift({
      id: makeId('DRV-DOC'),
      name: input.name,
      url: input.url,
      category: input.category,
      createdAt: new Date().toISOString(),
    });
    profile.updatedAt = new Date().toISOString();
    store.profiles[normalized] = profile;
    await writeStore(store);
    return profile;
  });
}

export function registerDriverDeliveryEarning(args: {
  identity: string;
  deliveryId: string;
  reference: string;
}): Promise<DriverProfile> {
  const normalized = normalizeIdentity(args.identity);
  return withLock(async () => {
    const store = await readStore();
    const profile = store.profiles[normalized] || emptyProfile(normalized);
    const alreadyExists = profile.earnings.some((entry) => entry.deliveryId === args.deliveryId);
    if (!alreadyExists && profile.defaultEarningAmount && profile.defaultEarningAmount > 0) {
      profile.earnings.unshift({
        id: makeId('DRV-EARN'),
        deliveryId: args.deliveryId,
        reference: args.reference,
        amount: profile.defaultEarningAmount,
        currency: profile.defaultEarningCurrency,
        createdAt: new Date().toISOString(),
      });
      profile.updatedAt = new Date().toISOString();
      store.profiles[normalized] = profile;
      await writeStore(store);
      return profile;
    }

    if (!store.profiles[normalized]) {
      store.profiles[normalized] = profile;
      await writeStore(store);
    }
    return profile;
  });
}
