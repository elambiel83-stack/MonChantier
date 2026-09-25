import { readStore, withStore } from './storeDb';

export type SavedAddress = {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
};

type AddressStoreModel = { addresses: Record<string, SavedAddress[]> };

const STORE_KEY = 'address-store';
const buildInitialStore = (): AddressStoreModel => ({ addresses: {} });

function normalizeIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

function generateId() {
  return `ADDR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listAddresses(identity: string): Promise<SavedAddress[]> {
  const normalized = normalizeIdentity(identity);
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.addresses[normalized] || [];
}

export function createAddress(identity: string, input: { label: string; address: string }): Promise<SavedAddress[]> {
  const normalized = normalizeIdentity(identity);
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const list = store.addresses[normalized] || [];
    list.push({
      id: generateId(),
      label: input.label,
      address: input.address,
      isDefault: list.length === 0,
      createdAt: new Date().toISOString(),
    });
    store.addresses[normalized] = list;
    return list;
  });
}

export function deleteAddress(identity: string, id: string): Promise<SavedAddress[]> {
  const normalized = normalizeIdentity(identity);
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const list = (store.addresses[normalized] || []).filter((a) => a.id !== id);
    store.addresses[normalized] = list;
    return list;
  });
}

export function setDefaultAddress(identity: string, id: string): Promise<SavedAddress[]> {
  const normalized = normalizeIdentity(identity);
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const list = store.addresses[normalized] || [];
    for (const address of list) address.isDefault = address.id === id;
    store.addresses[normalized] = list;
    return list;
  });
}
