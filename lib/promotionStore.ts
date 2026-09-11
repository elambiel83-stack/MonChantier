import { promises as fs } from 'fs';
import path from 'path';

export type PromotionTargetType = 'product' | 'service';

export type StoredPromotion = {
  id: number;
  itemType: PromotionTargetType;
  itemId: number;
  label: string;
  discountPercent: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PromotionStoreModel = { promotions: StoredPromotion[]; nextId: number };

const STORE_PATH = path.join(process.cwd(), 'data', 'promotion-store.json');

let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function buildSeedStore(): PromotionStoreModel {
  return { promotions: [], nextId: 1 };
}

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), 'utf8');
  }
}

async function readStore(): Promise<PromotionStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<PromotionStoreModel>;
    return {
      promotions: Array.isArray(parsed.promotions) ? parsed.promotions : [],
      nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
    };
  } catch {
    return buildSeedStore();
  }
}

async function writeStore(store: PromotionStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export function isPromotionLive(promotion: StoredPromotion, referenceDate = new Date()): boolean {
  if (!promotion.active) return false;
  const startsAt = promotion.startsAt ? new Date(promotion.startsAt) : null;
  const endsAt = promotion.endsAt ? new Date(promotion.endsAt) : null;

  if (promotion.startsAt && startsAt && Number.isNaN(startsAt.getTime())) return false;
  if (promotion.endsAt && endsAt && Number.isNaN(endsAt.getTime())) return false;

  if (startsAt && !Number.isNaN(startsAt.getTime()) && startsAt > referenceDate) return false;
  if (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt < referenceDate) return false;
  return true;
}

export function listPromotions(options?: {
  activeOnly?: boolean;
  itemType?: PromotionTargetType;
  itemIds?: number[];
}): Promise<StoredPromotion[]> {
  return withLock(async () => {
    const store = await readStore();
    return store.promotions.filter((promotion) => {
      if (options?.activeOnly && !isPromotionLive(promotion)) return false;
      if (options?.itemType && promotion.itemType !== options.itemType) return false;
      if (options?.itemIds && !options.itemIds.includes(promotion.itemId)) return false;
      return true;
    });
  });
}

export function getPromotion(id: number): Promise<StoredPromotion | null> {
  return withLock(async () => {
    const store = await readStore();
    return store.promotions.find((promotion) => promotion.id === id) || null;
  });
}

export function createPromotion(input: {
  itemType: PromotionTargetType;
  itemId: number;
  label: string;
  discountPercent: number;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<StoredPromotion> {
  return withLock(async () => {
    const store = await readStore();
    const now = new Date().toISOString();
    const promotion: StoredPromotion = {
      id: store.nextId,
      itemType: input.itemType,
      itemId: input.itemId,
      label: input.label.trim(),
      discountPercent: input.discountPercent,
      active: input.active ?? true,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    store.promotions.push(promotion);
    store.nextId += 1;
    await writeStore(store);
    return promotion;
  });
}

export type UpdatePromotionPatch = Partial<
  Pick<StoredPromotion, 'label' | 'discountPercent' | 'active' | 'startsAt' | 'endsAt'>
>;

export function updatePromotion(id: number, patch: UpdatePromotionPatch): Promise<StoredPromotion | null> {
  return withLock(async () => {
    const store = await readStore();
    const promotion = store.promotions.find((entry) => entry.id === id);
    if (!promotion) return null;
    Object.assign(promotion, patch, { updatedAt: new Date().toISOString() });
    await writeStore(store);
    return promotion;
  });
}

export function deletePromotion(id: number): Promise<boolean> {
  return withLock(async () => {
    const store = await readStore();
    const index = store.promotions.findIndex((promotion) => promotion.id === id);
    if (index === -1) return false;
    store.promotions.splice(index, 1);
    await writeStore(store);
    return true;
  });
}
