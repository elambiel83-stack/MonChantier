import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newDb } from 'pg-mem';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/monchantier/constants', () => ({
  products: [
    {
      id: 1,
      fr: 'Ciment',
      en: 'Cement',
      unitFr: 'sac',
      unitEn: 'bag',
      prices: { USD: 10, CDF: 28500 },
      img: 'cement.jpg',
      fallback: 'cement.jpg',
    },
  ],
  services: [],
}));

const mem = newDb({ autoCreateForeignKeyIndices: true });
const schema = readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
mem.public.none(schema);
const { Pool } = mem.adapters.createPg();
vi.mock('pg', () => ({ Pool }));
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

let createProduct: typeof import('./productStore').createProduct;
let decrementStock: typeof import('./productStore').decrementStock;
let restockItems: typeof import('./productStore').restockItems;
let getProduct: typeof import('./productStore').getProduct;

beforeAll(async () => {
  ({ createProduct, decrementStock, restockItems, getProduct } = await import('./productStore'));
});

describe('decrementStock / restockItems', () => {
  it('decrements stock atomically when enough is available', async () => {
    const product = await createProduct({
      fr: 'Sable',
      en: 'Sand',
      unitFr: 'm3',
      unitEn: 'm3',
      priceUSD: 5,
      priceCDF: 14000,
      img: 'sand.jpg',
      stock: 10,
    });

    const result = await decrementStock([{ productId: product.id, quantity: 3 }]);
    expect(result.success).toBe(true);

    const updated = await getProduct(product.id);
    expect(updated?.stock).toBe(7);
  });

  it('rejects the whole batch (all-or-nothing) when one item is short', async () => {
    const productA = await createProduct({
      fr: 'Brique A',
      en: 'Brick A',
      unitFr: 'unité',
      unitEn: 'unit',
      priceUSD: 1,
      priceCDF: 2800,
      img: 'brick-a.jpg',
      stock: 5,
    });
    const productB = await createProduct({
      fr: 'Brique B',
      en: 'Brick B',
      unitFr: 'unité',
      unitEn: 'unit',
      priceUSD: 1,
      priceCDF: 2800,
      img: 'brick-b.jpg',
      stock: 2,
    });

    const result = await decrementStock([
      { productId: productA.id, quantity: 1 },
      { productId: productB.id, quantity: 10 },
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.shortfalls).toEqual([{ productId: productB.id, requested: 10, available: 2 }]);
    }

    // Le produit A n'a pas été décrémenté malgré une quantité suffisante:
    // c'est tout ou rien.
    const updatedA = await getProduct(productA.id);
    expect(updatedA?.stock).toBe(5);
  });

  it('ignores products with untracked stock (null)', async () => {
    const product = await createProduct({
      fr: 'Service sur devis',
      en: 'Quote-based service',
      unitFr: 'unité',
      unitEn: 'unit',
      priceUSD: null,
      priceCDF: null,
      img: 'quote.jpg',
      stock: null,
    });

    const result = await decrementStock([{ productId: product.id, quantity: 99999 }]);
    expect(result.success).toBe(true);
  });

  it('restocks items back after a cancellation', async () => {
    const product = await createProduct({
      fr: 'Ciment gris',
      en: 'Grey cement',
      unitFr: 'sac',
      unitEn: 'bag',
      priceUSD: 10,
      priceCDF: 28500,
      img: 'cement-grey.jpg',
      stock: 4,
    });

    await decrementStock([{ productId: product.id, quantity: 4 }]);
    expect((await getProduct(product.id))?.stock).toBe(0);

    await restockItems([{ productId: product.id, quantity: 4 }]);
    expect((await getProduct(product.id))?.stock).toBe(4);
  });
});
