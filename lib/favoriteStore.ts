import { readStore, withStore } from './storeDb';

export type FavoriteItemType = 'product' | 'service';

export type Favorite = {
  id: string;
  itemType: FavoriteItemType;
  itemId: number;
  addedAt: string;
};

type FavoriteStoreModel = { favorites: Record<string, Favorite[]> };

const STORE_KEY = 'favorite-store';
const buildInitialStore = (): FavoriteStoreModel => ({ favorites: {} });

function normalizeIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

export async function listFavorites(identity: string): Promise<Favorite[]> {
  const normalized = normalizeIdentity(identity);
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.favorites[normalized] || [];
}

export function addFavorite(identity: string, itemType: FavoriteItemType, itemId: number): Promise<Favorite[]> {
  const normalized = normalizeIdentity(identity);
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const list = store.favorites[normalized] || [];
    if (!list.some((f) => f.itemType === itemType && f.itemId === itemId)) {
      list.push({ id: `${itemType}-${itemId}`, itemType, itemId, addedAt: new Date().toISOString() });
    }
    store.favorites[normalized] = list;
    return list;
  });
}

export function removeFavorite(identity: string, itemType: FavoriteItemType, itemId: number): Promise<Favorite[]> {
  const normalized = normalizeIdentity(identity);
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const list = (store.favorites[normalized] || []).filter(
      (f) => !(f.itemType === itemType && f.itemId === itemId)
    );
    store.favorites[normalized] = list;
    return list;
  });
}
