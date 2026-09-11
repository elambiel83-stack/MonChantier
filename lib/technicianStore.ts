import { promises as fs } from 'fs';
import path from 'path';

export type TechnicianEquipment = {
  id: string;
  name: string;
  quantity: number;
  condition: string;
  note?: string;
  updatedAt: string;
};

export type TechnicianPhoto = {
  id: string;
  name: string;
  url: string;
  category: string;
  createdAt: string;
};

export type TechnicianReview = {
  id: string;
  authorName: string;
  rating: number;
  comment?: string;
  createdAt: string;
};

export type TechnicianProfile = {
  identity: string;
  equipment: TechnicianEquipment[];
  photos: TechnicianPhoto[];
  reviews: TechnicianReview[];
  updatedAt: string;
};

type TechnicianStoreModel = {
  profiles: Record<string, TechnicianProfile>;
};

const STORE_PATH = path.join(process.cwd(), 'data', 'technician-store.json');
const INITIAL_STORE: TechnicianStoreModel = { profiles: {} };
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

function emptyProfile(identity: string): TechnicianProfile {
  return {
    identity,
    equipment: [],
    photos: [],
    reviews: [],
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

async function readStore(): Promise<TechnicianStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<TechnicianStoreModel>;
    return {
      profiles: parsed.profiles && typeof parsed.profiles === 'object' ? parsed.profiles : {},
    };
  } catch {
    return INITIAL_STORE;
  }
}

async function writeStore(store: TechnicianStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export function getTechnicianProfile(identity: string): Promise<TechnicianProfile> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    return store.profiles[normalized] || emptyProfile(normalized);
  });
}

export function addTechnicianEquipment(
  identity: string,
  input: { name: string; quantity: number; condition: string; note?: string }
): Promise<TechnicianProfile> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const profile = store.profiles[normalized] || emptyProfile(normalized);
    profile.equipment.unshift({
      id: makeId('TECH-EQP'),
      name: input.name,
      quantity: input.quantity,
      condition: input.condition,
      note: input.note,
      updatedAt: new Date().toISOString(),
    });
    profile.updatedAt = new Date().toISOString();
    store.profiles[normalized] = profile;
    await writeStore(store);
    return profile;
  });
}

export function addTechnicianPhoto(
  identity: string,
  input: { name: string; url: string; category: string }
): Promise<TechnicianProfile> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const profile = store.profiles[normalized] || emptyProfile(normalized);
    profile.photos.unshift({
      id: makeId('TECH-PHOTO'),
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

export function addTechnicianReview(
  identity: string,
  input: { authorName: string; rating: number; comment?: string }
): Promise<TechnicianProfile> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const profile = store.profiles[normalized] || emptyProfile(normalized);
    profile.reviews.unshift({
      id: makeId('TECH-REVIEW'),
      authorName: input.authorName,
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date().toISOString(),
    });
    profile.updatedAt = new Date().toISOString();
    store.profiles[normalized] = profile;
    await writeStore(store);
    return profile;
  });
}
