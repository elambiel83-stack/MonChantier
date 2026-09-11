import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

test('promotion store persists target, discount, schedule and activation state', async () => {
  const source = await read('lib/promotionStore.ts');

  assert.match(source, /export type PromotionTargetType = 'product' \| 'service'/);
  assert.match(source, /discountPercent: number/);
  assert.match(source, /startsAt: string \| null/);
  assert.match(source, /endsAt: string \| null/);
  assert.match(source, /export function isPromotionLive/);
  assert.match(source, /export function createPromotion/);
  assert.match(source, /export function updatePromotion/);
});

test('admin and supplier promotion routes are wired to stored promotions', async () => {
  const [adminRouteSource, adminDetailRouteSource, partnerRouteSource] = await Promise.all([
    read('app/api/admin/promotions/route.ts'),
    read('app/api/admin/promotions/[id]/route.ts'),
    read('app/api/partner/promotions/route.ts'),
  ]);

  assert.match(adminRouteSource, /requireAdmin/);
  assert.match(adminRouteSource, /createPromotion/);
  assert.match(adminDetailRouteSource, /updatePromotion/);
  assert.match(adminDetailRouteSource, /deletePromotion/);
  assert.match(partnerRouteSource, /listProductsByOwner/);
  assert.match(partnerRouteSource, /listPromotions/);
});

test('catalog and supplier views surface live promotions', async () => {
  const [productsSource, servicesSource, supplierSource, catalogHelperSource] = await Promise.all([
    read('components/monchantier/Products.tsx'),
    read('components/monchantier/Services.tsx'),
    read('components/monchantier/SupplierProductsPanel.tsx'),
    read('lib/catalogPromotions.ts'),
  ]);

  assert.match(productsSource, /promotionDiscountPercent/);
  assert.match(productsSource, /promotionLabel/);
  assert.match(servicesSource, /promotionDiscountPercent/);
  assert.match(supplierSource, /fetch\("\/api\/partner\/promotions"/);
  assert.doesNotMatch(supplierSource, /Aucune promotion dédiée n&apos;est encore stockée/);
  assert.match(catalogHelperSource, /export function applyCatalogPromotions/);
  assert.match(catalogHelperSource, /discountPercent/);
});
