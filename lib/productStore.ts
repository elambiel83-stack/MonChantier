import { products as seedProducts } from '@/components/monchantier/constants';
import { readStore, withStore } from './storeDb';

export type StoredProduct = {
  id: number;
  fr: string;
  en: string;
  unitFr: string;
  unitEn: string;
  priceUSD: number | null;
  priceCDF: number | null;
  img: string;
  fallback: string;
  active: boolean;
  // Absent = produit MonChantier (catalogue plateforme). Présent = produit
  // apporté par un partenaire (rôle "supplier"), identifié par son email.
  ownerIdentity?: string;
  createdAt: string;
  updatedAt: string;
};

type ProductStoreModel = { products: StoredProduct[]; nextId: number };

const STORE_KEY = 'product-store';

function buildSeedStore(): ProductStoreModel {
  const now = new Date().toISOString();
  const seeded: StoredProduct[] = seedProducts.map((p) => ({
    id: p.id,
    fr: p.fr,
    en: p.en,
    unitFr: p.unitFr,
    unitEn: p.unitEn,
    priceUSD: p.prices.USD,
    priceCDF: p.prices.CDF,
    img: p.img,
    fallback: p.fallback,
    active: true,
    createdAt: now,
    updatedAt: now,
  }));
  const nextId = seeded.reduce((max, p) => Math.max(max, p.id), 0) + 1;
  return { products: seeded, nextId };
}

export async function listProducts(options?: { activeOnly?: boolean }): Promise<StoredProduct[]> {
  const store = await readStore(STORE_KEY, buildSeedStore);
  return options?.activeOnly ? store.products.filter((p) => p.active) : store.products;
}

export async function getProduct(id: number): Promise<StoredProduct | null> {
  const store = await readStore(STORE_KEY, buildSeedStore);
  return store.products.find((p) => p.id === id) || null;
}

export async function listProductsByOwner(ownerIdentity: string): Promise<StoredProduct[]> {
  const normalized = ownerIdentity.trim().toLowerCase();
  const store = await readStore(STORE_KEY, buildSeedStore);
  return store.products.filter((p) => p.ownerIdentity === normalized);
}

export function createProduct(input: {
  fr: string;
  en: string;
  unitFr: string;
  unitEn: string;
  priceUSD: number | null;
  priceCDF: number | null;
  img: string;
  fallback?: string;
  ownerIdentity?: string;
}): Promise<StoredProduct> {
  return withStore(STORE_KEY, buildSeedStore, (store) => {
    const now = new Date().toISOString();
    const product: StoredProduct = {
      id: store.nextId,
      fr: input.fr,
      en: input.en,
      unitFr: input.unitFr,
      unitEn: input.unitEn,
      priceUSD: input.priceUSD,
      priceCDF: input.priceCDF,
      img: input.img,
      fallback: input.fallback || input.img,
      active: true,
      ownerIdentity: input.ownerIdentity?.trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };
    store.products.push(product);
    store.nextId += 1;
    return product;
  });
}

export type UpdateProductPatch = Partial<
  Pick<StoredProduct, 'fr' | 'en' | 'unitFr' | 'unitEn' | 'priceUSD' | 'priceCDF' | 'img' | 'fallback' | 'active'>
>;

export function updateProduct(id: number, patch: UpdateProductPatch): Promise<StoredProduct | null> {
  return withStore(STORE_KEY, buildSeedStore, (store) => {
    const product = store.products.find((p) => p.id === id);
    if (!product) return null;
    Object.assign(product, patch, { updatedAt: new Date().toISOString() });
    return product;
  });
}

export function deleteProduct(id: number): Promise<boolean> {
  return withStore(STORE_KEY, buildSeedStore, (store) => {
    const index = store.products.findIndex((p) => p.id === id);
    if (index === -1) return false;
    store.products.splice(index, 1);
    return true;
  });
}
