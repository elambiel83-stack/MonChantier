import { promises as fs } from 'fs';
import path from 'path';
import { products as seedProducts } from '@/components/monchantier/constants';

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

const STORE_PATH = path.join(process.cwd(), 'data', 'product-store.json');

let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

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

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), 'utf8');
  }
}

async function readStore(): Promise<ProductStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<ProductStoreModel>;
    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
    };
  } catch {
    return buildSeedStore();
  }
}

async function writeStore(store: ProductStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export function listProducts(options?: { activeOnly?: boolean }): Promise<StoredProduct[]> {
  return withLock(async () => {
    const store = await readStore();
    return options?.activeOnly ? store.products.filter((p) => p.active) : store.products;
  });
}

export function getProduct(id: number): Promise<StoredProduct | null> {
  return withLock(async () => {
    const store = await readStore();
    return store.products.find((p) => p.id === id) || null;
  });
}

export function listProductsByOwner(ownerIdentity: string): Promise<StoredProduct[]> {
  const normalized = ownerIdentity.trim().toLowerCase();
  return withLock(async () => {
    const store = await readStore();
    return store.products.filter((p) => p.ownerIdentity === normalized);
  });
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
  return withLock(async () => {
    const store = await readStore();
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
    await writeStore(store);
    return product;
  });
}

export type UpdateProductPatch = Partial<
  Pick<StoredProduct, 'fr' | 'en' | 'unitFr' | 'unitEn' | 'priceUSD' | 'priceCDF' | 'img' | 'fallback' | 'active'>
>;

export function updateProduct(id: number, patch: UpdateProductPatch): Promise<StoredProduct | null> {
  return withLock(async () => {
    const store = await readStore();
    const product = store.products.find((p) => p.id === id);
    if (!product) return null;
    Object.assign(product, patch, { updatedAt: new Date().toISOString() });
    await writeStore(store);
    return product;
  });
}

export function deleteProduct(id: number): Promise<boolean> {
  return withLock(async () => {
    const store = await readStore();
    const index = store.products.findIndex((p) => p.id === id);
    if (index === -1) return false;
    store.products.splice(index, 1);
    await writeStore(store);
    return true;
  });
}
