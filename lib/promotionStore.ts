import { readStorePayload, writeStorePayload } from './serverStateStore';

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

const STORE_KEY = 'promotion-store.json';

function normalizeDiscountPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value >= 100) {
    throw new RangeError('Discount percent must be between 0 and 100');
  }

  return value;
}

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


async function readStore(): Promise<PromotionStoreModel> {
  const raw = await readStorePayload(STORE_KEY, () => JSON.stringify(buildSeedStore(), null, 2), { legacyFileName: STORE_KEY });
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
  await writeStorePayload(STORE_KEY, JSON.stringify(store, null, 2));
}

function normalizePromotionWindow(
  value: string | null | undefined,
  boundary: 'start' | 'end'
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;

  if (boundary === 'end') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      parsed.setHours(23, 59, 59, 999);
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
      parsed.setSeconds(59, 999);
    }
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    parsed.setHours(0, 0, 0, 0);
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    parsed.setSeconds(0, 0);
  }

  return parsed.toISOString();
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
      discountPercent: normalizeDiscountPercent(input.discountPercent),
      active: input.active ?? true,
      startsAt: normalizePromotionWindow(input.startsAt, 'start') ?? null,
      endsAt: normalizePromotionWindow(input.endsAt, 'end') ?? null,
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
    const sanitizedPatch: UpdatePromotionPatch = {};
    if (patch.label !== undefined) sanitizedPatch.label = patch.label;
    if (patch.discountPercent !== undefined) sanitizedPatch.discountPercent = normalizeDiscountPercent(patch.discountPercent);
    if (patch.active !== undefined) sanitizedPatch.active = patch.active;
    if (patch.startsAt !== undefined) sanitizedPatch.startsAt = normalizePromotionWindow(patch.startsAt, 'start');
    if (patch.endsAt !== undefined) sanitizedPatch.endsAt = normalizePromotionWindow(patch.endsAt, 'end');
    Object.assign(promotion, sanitizedPatch, { updatedAt: new Date().toISOString() });
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
