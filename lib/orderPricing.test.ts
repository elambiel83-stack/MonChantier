import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newDb } from 'pg-mem';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/monchantier/constants', () => ({
  products: [{
    id: 1, fr: 'Ciment', en: 'Cement', unitFr: 'sac', unitEn: 'bag',
    prices: { USD: 10, CDF: 28500 }, img: 'cement.jpg', fallback: 'cement.jpg',
  }],
  services: [],
}));

const mem = newDb({ autoCreateForeignKeyIndices: true });
const schema = readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
mem.public.none(schema);
const { Pool } = mem.adapters.createPg();
vi.mock('pg', () => ({ Pool }));
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

let priceOrderFromCatalog: typeof import('./orderPricing').priceOrderFromCatalog;
let createProduct: typeof import('./productStore').createProduct;

beforeAll(async () => {
  ({ priceOrderFromCatalog } = await import('./orderPricing'));
  ({ createProduct } = await import('./productStore'));
});

describe('priceOrderFromCatalog', () => {
  it('ignore les prix et libellés falsifiés par le navigateur', async () => {
    const order = await priceOrderFromCatalog([
      { productId: 1, quantity: 3, unitPrice: 0.01, productName: 'Produit piraté' },
    ], 'USD');

    expect(order.amount).toBe(30);
    expect(order.items[0]).toMatchObject({ productName: 'Ciment', unitPrice: 10, quantity: 3 });
  });

  it('calcule le total CDF depuis le catalogue serveur', async () => {
    const order = await priceOrderFromCatalog([{ productId: 1, quantity: 2 }], 'CDF');
    expect(order.amount).toBe(57000);
    expect(order.currency).toBe('CDF');
  });

  it('refuse les produits inconnus et les quantités non entières', async () => {
    await expect(priceOrderFromCatalog([{ productId: 999, quantity: 1 }], 'USD'))
      .rejects.toThrow('indisponible');
    await expect(priceOrderFromCatalog([{ productId: 1, quantity: 1.5 }], 'USD'))
      .rejects.toThrow('Quantité invalide');
  });

  it('refuse une quantité supérieure au stock suivi', async () => {
    const product = await createProduct({
      fr: 'Brique', en: 'Brick', unitFr: 'unité', unitEn: 'unit',
      priceUSD: 1, priceCDF: 2800, img: 'brick.jpg', stock: 2,
    });
    await expect(priceOrderFromCatalog([{ productId: product.id, quantity: 3 }], 'USD'))
      .rejects.toThrow('Stock insuffisant');
  });

  it('refuse une devise ou un article sans identifiant catalogue', async () => {
    await expect(priceOrderFromCatalog([{ productId: 1, quantity: 1 }], 'EUR'))
      .rejects.toThrow('Devise non prise en charge');
    await expect(priceOrderFromCatalog([{ productName: 'Service', quantity: 1 }], 'USD'))
      .rejects.toThrow('doivent passer par un devis');
  });
});
