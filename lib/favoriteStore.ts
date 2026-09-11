import { readStorePayload, writeStorePayload } from './serverStateStore';

export type FavoriteItemType = 'product' | 'service';

export type Favorite = {
  id: string;
  itemType: FavoriteItemType;
  itemId: number;
  addedAt: string;
};

type FavoriteStoreModel = { favorites: Record<string, Favorite[]> };

const STORE_KEY = 'favorite-store.json';
const INITIAL_STORE: FavoriteStoreModel = { favorites: {} };

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


async function readStore(): Promise<FavoriteStoreModel> {
  const raw = await readStorePayload(STORE_KEY, () => JSON.stringify(INITIAL_STORE, null, 2), { legacyFileName: STORE_KEY });
  try {
    const parsed = JSON.parse(raw) as Partial<FavoriteStoreModel>;
    return { favorites: parsed.favorites && typeof parsed.favorites === 'object' ? parsed.favorites : {} };
  } catch {
    return { ...INITIAL_STORE };
  }
}

async function writeStore(store: FavoriteStoreModel) {
  await writeStorePayload(STORE_KEY, JSON.stringify(store, null, 2));
}

export function listFavorites(identity: string): Promise<Favorite[]> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => (await readStore()).favorites[normalized] || []);
}

export function addFavorite(identity: string, itemType: FavoriteItemType, itemId: number): Promise<Favorite[]> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const list = store.favorites[normalized] || [];
    if (!list.some((f) => f.itemType === itemType && f.itemId === itemId)) {
      list.push({ id: `${itemType}-${itemId}`, itemType, itemId, addedAt: new Date().toISOString() });
    }
    store.favorites[normalized] = list;
    await writeStore(store);
    return list;
  });
}

export function removeFavorite(identity: string, itemType: FavoriteItemType, itemId: number): Promise<Favorite[]> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const list = (store.favorites[normalized] || []).filter(
      (f) => !(f.itemType === itemType && f.itemId === itemId)
    );
    store.favorites[normalized] = list;
    await writeStore(store);
    return list;
  });
}
