import { promises as fs } from 'fs';
import path from 'path';
import { services as seedServices } from '@/components/monchantier/constants';

export type StoredService = {
  id: number;
  icon: string;
  fr: string;
  en: string;
  frDesc: string;
  enDesc: string;
  img: string;
  priceUSD: number | null;
  priceCDF: number | null;
  active: boolean;
  // Absent = service MonChantier (catalogue plateforme). Présent = service
  // apporté par un partenaire (rôle "technician"), identifié par son email.
  ownerIdentity?: string;
  createdAt: string;
  updatedAt: string;
};

type ServiceStoreModel = { services: StoredService[]; nextId: number };

const STORE_PATH = path.join(process.cwd(), 'data', 'service-store.json');

let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function buildSeedStore(): ServiceStoreModel {
  const now = new Date().toISOString();
  const seeded: StoredService[] = seedServices.map((s, index) => ({
    id: index + 1,
    icon: s.icon,
    fr: s.fr,
    en: s.en,
    frDesc: s.frDesc,
    enDesc: s.enDesc,
    img: s.img,
    priceUSD: null,
    priceCDF: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  }));
  return { services: seeded, nextId: seeded.length + 1 };
}

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), 'utf8');
  }
}

async function readStore(): Promise<ServiceStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceStoreModel>;
    return {
      services: Array.isArray(parsed.services) ? parsed.services : [],
      nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
    };
  } catch {
    return buildSeedStore();
  }
}

async function writeStore(store: ServiceStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export function listServices(options?: { activeOnly?: boolean }): Promise<StoredService[]> {
  return withLock(async () => {
    const store = await readStore();
    return options?.activeOnly ? store.services.filter((s) => s.active) : store.services;
  });
}

export function getService(id: number): Promise<StoredService | null> {
  return withLock(async () => {
    const store = await readStore();
    return store.services.find((s) => s.id === id) || null;
  });
}

export function listServicesByOwner(ownerIdentity: string): Promise<StoredService[]> {
  const normalized = ownerIdentity.trim().toLowerCase();
  return withLock(async () => {
    const store = await readStore();
    return store.services.filter((s) => s.ownerIdentity === normalized);
  });
}

export function createService(input: {
  icon: string;
  fr: string;
  en: string;
  frDesc: string;
  enDesc: string;
  img: string;
  priceUSD: number | null;
  priceCDF: number | null;
  ownerIdentity?: string;
}): Promise<StoredService> {
  return withLock(async () => {
    const store = await readStore();
    const now = new Date().toISOString();
    const service: StoredService = {
      id: store.nextId,
      icon: input.icon,
      fr: input.fr,
      en: input.en,
      frDesc: input.frDesc,
      enDesc: input.enDesc,
      img: input.img,
      priceUSD: input.priceUSD,
      priceCDF: input.priceCDF,
      ownerIdentity: input.ownerIdentity?.trim().toLowerCase(),
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    store.services.push(service);
    store.nextId += 1;
    await writeStore(store);
    return service;
  });
}

export type UpdateServicePatch = Partial<
  Pick<StoredService, 'icon' | 'fr' | 'en' | 'frDesc' | 'enDesc' | 'img' | 'priceUSD' | 'priceCDF' | 'active'>
>;

export function updateService(id: number, patch: UpdateServicePatch): Promise<StoredService | null> {
  return withLock(async () => {
    const store = await readStore();
    const service = store.services.find((s) => s.id === id);
    if (!service) return null;
    Object.assign(service, patch, { updatedAt: new Date().toISOString() });
    await writeStore(store);
    return service;
  });
}

export function deleteService(id: number): Promise<boolean> {
  return withLock(async () => {
    const store = await readStore();
    const index = store.services.findIndex((s) => s.id === id);
    if (index === -1) return false;
    store.services.splice(index, 1);
    await writeStore(store);
    return true;
  });
}
