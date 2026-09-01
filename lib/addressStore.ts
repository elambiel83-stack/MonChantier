import { promises as fs } from 'fs';
import path from 'path';

export type SavedAddress = {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
};

type AddressStoreModel = { addresses: Record<string, SavedAddress[]> };

const STORE_PATH = path.join(process.cwd(), 'data', 'address-store.json');
const INITIAL_STORE: AddressStoreModel = { addresses: {} };

let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function normalizeIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

function generateId() {
  return `ADDR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(INITIAL_STORE, null, 2), 'utf8');
  }
}

async function readStore(): Promise<AddressStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<AddressStoreModel>;
    return { addresses: parsed.addresses && typeof parsed.addresses === 'object' ? parsed.addresses : {} };
  } catch {
    return { ...INITIAL_STORE };
  }
}

async function writeStore(store: AddressStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export function listAddresses(identity: string): Promise<SavedAddress[]> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => (await readStore()).addresses[normalized] || []);
}

export function createAddress(identity: string, input: { label: string; address: string }): Promise<SavedAddress[]> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const list = store.addresses[normalized] || [];
    list.push({
      id: generateId(),
      label: input.label,
      address: input.address,
      isDefault: list.length === 0,
      createdAt: new Date().toISOString(),
    });
    store.addresses[normalized] = list;
    await writeStore(store);
    return list;
  });
}

export function deleteAddress(identity: string, id: string): Promise<SavedAddress[]> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const list = (store.addresses[normalized] || []).filter((a) => a.id !== id);
    store.addresses[normalized] = list;
    await writeStore(store);
    return list;
  });
}

export function setDefaultAddress(identity: string, id: string): Promise<SavedAddress[]> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const list = store.addresses[normalized] || [];
    for (const address of list) address.isDefault = address.id === id;
    store.addresses[normalized] = list;
    await writeStore(store);
    return list;
  });
}
