import { readStore, tenantKey, withStore } from './storeDb';

// Catalogue produit d'un tenant SaaS — démontre le schéma tenant-scoped
// (voir lib/storeDb.ts::tenantKey) sur un domaine simple. Volontairement
// distinct de lib/productStore.ts (catalogue de l'app mono-tenant MonChantier
// existante, avec fournisseurs partenaires, devises USD/CDF...) pour ne rien
// changer au comportement déjà testé de cette dernière.

export type TenantProduct = {
  id: number;
  name: string;
  priceCents: number;
  currency: string;
  stock: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type TenantCatalogModel = { products: TenantProduct[]; nextId: number };

const STORE_BASE = 'tenant-catalog-store';
const buildInitialStore = (): TenantCatalogModel => ({ products: [], nextId: 1 });

export async function listTenantProducts(tenantId: string): Promise<TenantProduct[]> {
  const store = await readStore(tenantKey(tenantId, STORE_BASE), buildInitialStore);
  return store.products;
}

export async function countTenantProducts(tenantId: string): Promise<number> {
  const store = await readStore(tenantKey(tenantId, STORE_BASE), buildInitialStore);
  return store.products.length;
}

export function createTenantProduct(
  tenantId: string,
  input: { name: string; priceCents: number; currency: string; stock?: number | null }
): Promise<TenantProduct> {
  return withStore(tenantKey(tenantId, STORE_BASE), buildInitialStore, (store) => {
    const now = new Date().toISOString();
    const product: TenantProduct = {
      id: store.nextId,
      name: input.name,
      priceCents: input.priceCents,
      currency: input.currency,
      stock: input.stock ?? null,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    store.products.push(product);
    store.nextId += 1;
    return product;
  });
}

export type UpdateTenantProductPatch = Partial<Pick<TenantProduct, 'name' | 'priceCents' | 'currency' | 'stock' | 'active'>>;

export function updateTenantProduct(
  tenantId: string,
  productId: number,
  patch: UpdateTenantProductPatch
): Promise<TenantProduct | null> {
  return withStore(tenantKey(tenantId, STORE_BASE), buildInitialStore, (store) => {
    const product = store.products.find((p) => p.id === productId);
    if (!product) return null;
    Object.assign(product, patch, { updatedAt: new Date().toISOString() });
    return product;
  });
}

export function deleteTenantProduct(tenantId: string, productId: number): Promise<boolean> {
  return withStore(tenantKey(tenantId, STORE_BASE), buildInitialStore, (store) => {
    const index = store.products.findIndex((p) => p.id === productId);
    if (index === -1) return false;
    store.products.splice(index, 1);
    return true;
  });
}
