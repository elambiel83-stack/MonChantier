import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

async function importPromotionModules() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monchantier-promotions-'));
  const [promotionStoreSource, catalogPromotionsSource] = await Promise.all([
    read('lib/promotionStore.ts'),
    read('lib/catalogPromotions.ts'),
  ]);
  const serverStateStoreSource = await read('lib/serverStateStore.ts');

  const promotionStoreOutput = ts.transpileModule(promotionStoreSource, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace('./serverStateStore', './serverStateStore.mjs');
  const serverStateStoreOutput = ts.transpileModule(serverStateStoreSource, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const catalogPromotionsOutput = ts
    .transpileModule(catalogPromotionsSource, {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    })
    .outputText.replace('./promotionStore', './promotionStore.mjs');

  await Promise.all([
    fs.writeFile(path.join(tempDir, 'promotionStore.mjs'), promotionStoreOutput, 'utf8'),
    fs.writeFile(path.join(tempDir, 'serverStateStore.mjs'), serverStateStoreOutput, 'utf8'),
    fs.writeFile(path.join(tempDir, 'catalogPromotions.mjs'), catalogPromotionsOutput, 'utf8'),
  ]);

  const previousCwd = process.cwd();
  process.chdir(tempDir);
  try {
    const [promotionStore, catalogPromotions] = await Promise.all([
      import(`file://${path.join(tempDir, 'promotionStore.mjs')}`),
      import(`file://${path.join(tempDir, 'catalogPromotions.mjs')}`),
    ]);
    return { promotionStore, catalogPromotions, restore: () => process.chdir(previousCwd) };
  } catch (error) {
    process.chdir(previousCwd);
    throw error;
  }
}

test('promotion live-window rules handle scheduled, expired, inactive and invalid promotions', async () => {
  const { promotionStore, restore } = await importPromotionModules();

  try {
    const { isPromotionLive } = promotionStore;
    const now = new Date('2026-09-11T12:00:00.000Z');

    assert.equal(isPromotionLive({ active: true, startsAt: null, endsAt: null }, now), true);
    assert.equal(isPromotionLive({ active: false, startsAt: null, endsAt: null }, now), false);
    assert.equal(isPromotionLive({ active: true, startsAt: '2026-09-12T00:00:00.000Z', endsAt: null }, now), false);
    assert.equal(isPromotionLive({ active: true, startsAt: null, endsAt: '2026-09-10T00:00:00.000Z' }, now), false);
    assert.equal(isPromotionLive({ active: true, startsAt: 'not-a-date', endsAt: null }, now), false);
  } finally {
    restore();
  }
});

test('promotion store rejects invalid discount writes', async () => {
  const { promotionStore, restore } = await importPromotionModules();

  try {
    await assert.rejects(
      () =>
        promotionStore.createPromotion({
          itemType: 'product',
          itemId: 1,
          label: 'Invalid',
          discountPercent: 0,
        }),
      RangeError
    );

    const promotion = await promotionStore.createPromotion({
      itemType: 'service',
      itemId: 2,
      label: 'Valid',
      discountPercent: 20,
    });

    await assert.rejects(() => promotionStore.updatePromotion(promotion.id, { discountPercent: 120 }), RangeError);
  } finally {
    restore();
  }
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
  const [productsSource, servicesSource, supplierSource] = await Promise.all([
    read('components/monchantier/Products.tsx'),
    read('components/monchantier/Services.tsx'),
    read('components/monchantier/SupplierProductsPanel.tsx'),
  ]);

  assert.match(productsSource, /promotionDiscountPercent/);
  assert.match(productsSource, /promotionLabel/);
  assert.match(servicesSource, /promotionDiscountPercent/);
  assert.match(supplierSource, /fetch\("\/api\/partner\/promotions"/);
  assert.doesNotMatch(supplierSource, /Aucune promotion dédiée n&apos;est encore stockée/);
});

test('catalog promotions apply the best live discount and preserve original prices', async () => {
  const { catalogPromotions, restore } = await importPromotionModules();

  try {
    const { applyCatalogPromotions } = catalogPromotions;

    const [promoted] = applyCatalogPromotions(
      [{ id: 3, priceUSD: 100, priceCDF: 200000 }],
      [
        {
          id: 1,
          itemType: 'product',
          itemId: 3,
          label: 'Expired',
          discountPercent: 40,
          active: true,
          startsAt: null,
          endsAt: '2020-01-01T00:00:00.000Z',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 2,
          itemType: 'product',
          itemId: 3,
          label: 'Live',
          discountPercent: 15,
          active: true,
          startsAt: null,
          endsAt: null,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 3,
          itemType: 'product',
          itemId: 3,
          label: 'Best',
          discountPercent: 25,
          active: true,
          startsAt: null,
          endsAt: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
      'product'
    );

    assert.equal(promoted.priceUSD, 75);
    assert.equal(promoted.priceCDF, 150000);
    assert.equal(promoted.originalPriceUSD, 100);
    assert.equal(promoted.originalPriceCDF, 200000);
    assert.equal(promoted.promotionLabel, 'Best');
    assert.equal(promoted.promotionDiscountPercent, 25);
  } finally {
    restore();
  }
});

test('catalog promotions keep product and service ids isolated', async () => {
  const { catalogPromotions, restore } = await importPromotionModules();

  try {
    const { applyCatalogPromotions } = catalogPromotions;

    const [productResult] = applyCatalogPromotions(
      [{ id: 7, priceUSD: 100, priceCDF: null }],
      [
        {
          id: 1,
          itemType: 'service',
          itemId: 7,
          label: 'Service only',
          discountPercent: 50,
          active: true,
          startsAt: null,
          endsAt: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
      'product'
    );

    assert.equal(productResult.priceUSD, 100);
    assert.equal(productResult.promotionLabel, null);
  } finally {
    restore();
  }
});
