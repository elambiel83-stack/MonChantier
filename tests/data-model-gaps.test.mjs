import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = '/home/runner/work/MonChantier/MonChantier';

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

test('driver profile model covers vehicle, documents and earnings', async () => {
  const source = await read('lib/driverStore.ts');

  assert.match(source, /export type DriverVehicle/);
  assert.match(source, /export type DriverDocument/);
  assert.match(source, /export type DriverEarning/);
  assert.match(source, /defaultEarningAmount: number \| null/);
  assert.match(source, /registerDriverDeliveryEarning/);
});

test('delivery completion records driver earnings', async () => {
  const source = await read('lib/deliveryStore.ts');

  assert.match(source, /registerDriverDeliveryEarning/);
  assert.match(source, /if \(args\.status === 'delivered' && delivery\.driverIdentity\)/);
});

test('driver dashboard and api use the new driver profile model', async () => {
  const [apiSource, panelSource] = await Promise.all([
    read('app/api/driver/profile/route.ts'),
    read('components/monchantier/DriverDeliveriesPanel.tsx'),
  ]);

  assert.match(apiSource, /export async function GET/);
  assert.match(apiSource, /export async function PATCH/);
  assert.match(apiSource, /export async function POST/);
  assert.match(panelSource, /fetch\("\/api\/driver\/profile"/);
  assert.match(panelSource, /id="vehicule"/);
  assert.match(panelSource, /id="documents"/);
  assert.match(panelSource, /id="revenus"/);
});

test('site model covers materials, documents and photos and site manager uses them', async () => {
  const [storeSource, routeSource, panelSource] = await Promise.all([
    read('lib/siteStore.ts'),
    read('app/api/sites/[id]/route.ts'),
    read('components/monchantier/SiteManagerPanel.tsx'),
  ]);

  assert.match(storeSource, /export type SiteMaterial/);
  assert.match(storeSource, /export type SiteDocument/);
  assert.match(storeSource, /export type SitePhoto/);
  assert.match(storeSource, /materials: SiteMaterial\[\]/);
  assert.match(storeSource, /documents: SiteDocument\[\]/);
  assert.match(storeSource, /photos: SitePhoto\[\]/);
  assert.match(routeSource, /if \(Array\.isArray\(body\?\.materials\)\)/);
  assert.match(routeSource, /if \(Array\.isArray\(body\?\.documents\)\)/);
  assert.match(routeSource, /if \(Array\.isArray\(body\?\.photos\)\)/);
  assert.match(panelSource, /id="materiaux"/);
  assert.match(panelSource, /id="documents"/);
  assert.match(panelSource, /id="photos"/);
});
