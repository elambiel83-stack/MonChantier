import { promises as fs } from 'fs';
import path from 'path';
import { buildTechnicianReviewKey } from '@/lib/technicianReviewWorkflow';

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
  authorIdentity?: string;
  authorName: string;
  rating: number;
  comment?: string;
  orderReference?: string;
  serviceId?: number;
  serviceName?: string;
  verified?: boolean;
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
      profiles:
        parsed.profiles && typeof parsed.profiles === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.profiles).map(([identity, profile]) => [
                identity,
                {
                  identity,
                  equipment: Array.isArray(profile?.equipment) ? profile.equipment : [],
                  photos: Array.isArray(profile?.photos) ? profile.photos : [],
                  reviews: Array.isArray(profile?.reviews)
                    ? profile.reviews
                        .filter((review) => review && typeof review === 'object')
                        .map((review) => ({
                          id: String(review.id || makeId('TECH-REVIEW')),
                          authorIdentity: String(review.authorIdentity || '').trim() || undefined,
                          authorName: String(review.authorName || 'Client').trim() || 'Client',
                          rating: Number(review.rating) || 0,
                          comment: String(review.comment || '').trim() || undefined,
                          orderReference: String(review.orderReference || '').trim() || undefined,
                          serviceId:
                            typeof review.serviceId === 'number' && Number.isFinite(review.serviceId)
                              ? review.serviceId
                              : undefined,
                          serviceName: String(review.serviceName || '').trim() || undefined,
                          verified: Boolean(review.verified),
                          createdAt: String(review.createdAt || new Date().toISOString()),
                        }))
                        .filter((review) => review.rating >= 1 && review.rating <= 5)
                    : [],
                  updatedAt: String(profile?.updatedAt || new Date().toISOString()),
                },
              ])
            )
          : {},
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
  input: {
    authorIdentity?: string;
    authorName: string;
    rating: number;
    comment?: string;
    orderReference?: string;
    serviceId?: number;
    serviceName?: string;
    verified?: boolean;
  }
): Promise<TechnicianProfile> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const profile = store.profiles[normalized] || emptyProfile(normalized);
    const nextReviewKey =
      input.authorIdentity && input.orderReference && input.serviceId !== undefined
        ? buildTechnicianReviewKey({
            technicianIdentity: normalized,
            authorIdentity: input.authorIdentity,
            orderReference: input.orderReference,
            serviceId: input.serviceId,
          })
        : null;
    if (
      nextReviewKey &&
      profile.reviews.some(
        (review) =>
          review.authorIdentity &&
          review.orderReference &&
          review.serviceId !== undefined &&
          buildTechnicianReviewKey({
            technicianIdentity: normalized,
            authorIdentity: review.authorIdentity,
            orderReference: review.orderReference,
            serviceId: review.serviceId,
          }) === nextReviewKey
      )
    ) {
      return profile;
    }
    profile.reviews.unshift({
      id: makeId('TECH-REVIEW'),
      authorIdentity: input.authorIdentity ? normalizeIdentity(input.authorIdentity) : undefined,
      authorName: input.authorName,
      rating: input.rating,
      comment: input.comment,
      orderReference: input.orderReference,
      serviceId: input.serviceId,
      serviceName: input.serviceName,
      verified: Boolean(input.verified),
      createdAt: new Date().toISOString(),
    });
    profile.updatedAt = new Date().toISOString();
    store.profiles[normalized] = profile;
    await writeStore(store);
    return profile;
  });
}

export function hasTechnicianReview(
  identity: string,
  input: { authorIdentity: string; orderReference: string; serviceId: number }
): Promise<boolean> {
  const normalized = normalizeIdentity(identity);
  const key = buildTechnicianReviewKey({
    technicianIdentity: normalized,
    authorIdentity: normalizeIdentity(input.authorIdentity),
    orderReference: input.orderReference,
    serviceId: input.serviceId,
  });
  return withLock(async () => {
    const store = await readStore();
    const profile = store.profiles[normalized];
    if (!profile) return false;
    return profile.reviews.some(
      (review) =>
        review.authorIdentity &&
        review.orderReference &&
        review.serviceId !== undefined &&
        buildTechnicianReviewKey({
          technicianIdentity: normalized,
          authorIdentity: review.authorIdentity,
          orderReference: review.orderReference,
          serviceId: review.serviceId,
        }) === key
    );
  });
}

export function listTechnicianReviewKeysByAuthor(authorIdentity: string): Promise<string[]> {
  const normalized = normalizeIdentity(authorIdentity);
  return withLock(async () => {
    const store = await readStore();
    return Object.entries(store.profiles).flatMap(([technicianIdentity, profile]) =>
      (profile.reviews || [])
        .filter((review) => review.authorIdentity && review.orderReference && review.serviceId !== undefined)
        .filter((review) => normalizeIdentity(review.authorIdentity as string) === normalized)
        .map((review) =>
          buildTechnicianReviewKey({
            technicianIdentity,
            authorIdentity: review.authorIdentity as string,
            orderReference: review.orderReference as string,
            serviceId: review.serviceId as number,
          })
        )
    );
  });
}
