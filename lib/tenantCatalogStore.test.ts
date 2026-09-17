import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newDb } from 'pg-mem';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mem = newDb({ autoCreateForeignKeyIndices: true });
const schema = readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
mem.public.none(schema);
const { Pool } = mem.adapters.createPg();
vi.mock('pg', () => ({ Pool }));
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

let createTenantProduct: typeof import('./tenantCatalogStore').createTenantProduct;
let listTenantProducts: typeof import('./tenantCatalogStore').listTenantProducts;
let countTenantProducts: typeof import('./tenantCatalogStore').countTenantProducts;
let updateTenantProduct: typeof import('./tenantCatalogStore').updateTenantProduct;
let deleteTenantProduct: typeof import('./tenantCatalogStore').deleteTenantProduct;

beforeAll(async () => {
  ({ createTenantProduct, listTenantProducts, countTenantProducts, updateTenantProduct, deleteTenantProduct } =
    await import('./tenantCatalogStore'));
});

describe('tenantCatalogStore', () => {
  it('isolates products between two tenants', async () => {
    const tenantA = `TNT-A-${Math.random()}`;
    const tenantB = `TNT-B-${Math.random()}`;

    await createTenantProduct(tenantA, { name: 'Ciment', priceCents: 1000, currency: 'USD' });
    await createTenantProduct(tenantB, { name: 'Sable', priceCents: 500, currency: 'USD' });

    expect(await listTenantProducts(tenantA)).toHaveLength(1);
    expect(await listTenantProducts(tenantB)).toHaveLength(1);
    expect((await listTenantProducts(tenantA))[0].name).toBe('Ciment');
  });

  it('counts products for limit checks', async () => {
    const tenantId = `TNT-${Math.random()}`;
    expect(await countTenantProducts(tenantId)).toBe(0);
    await createTenantProduct(tenantId, { name: 'A', priceCents: 100, currency: 'USD' });
    await createTenantProduct(tenantId, { name: 'B', priceCents: 100, currency: 'USD' });
    expect(await countTenantProducts(tenantId)).toBe(2);
  });

  it('updates and deletes a product scoped to its tenant', async () => {
    const tenantId = `TNT-${Math.random()}`;
    const product = await createTenantProduct(tenantId, { name: 'Brique', priceCents: 200, currency: 'USD', stock: 10 });

    const updated = await updateTenantProduct(tenantId, product.id, { priceCents: 250, active: false });
    expect(updated?.priceCents).toBe(250);
    expect(updated?.active).toBe(false);

    expect(await deleteTenantProduct(tenantId, product.id)).toBe(true);
    expect(await listTenantProducts(tenantId)).toHaveLength(0);
  });

  it('does not let one tenant update or delete another tenant\'s product', async () => {
    const tenantA = `TNT-A-${Math.random()}`;
    const tenantB = `TNT-B-${Math.random()}`;
    const product = await createTenantProduct(tenantA, { name: 'Ciment', priceCents: 1000, currency: 'USD' });

    expect(await updateTenantProduct(tenantB, product.id, { priceCents: 1 })).toBeNull();
    expect(await deleteTenantProduct(tenantB, product.id)).toBe(false);
    expect(await listTenantProducts(tenantA)).toHaveLength(1);
  });

  it('defaults stock to null (untracked) when not provided', async () => {
    const tenantId = `TNT-${Math.random()}`;
    const product = await createTenantProduct(tenantId, { name: 'Service', priceCents: 0, currency: 'USD' });
    expect(product.stock).toBeNull();
  });
});
