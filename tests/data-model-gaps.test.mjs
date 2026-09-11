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
  const [storeSource, routeSource, summaryRouteSource, panelSource] = await Promise.all([
    read('lib/siteStore.ts'),
    read('app/api/sites/[id]/route.ts'),
    read('app/api/sites/[id]/summary/route.ts'),
    read('components/monchantier/SiteManagerPanel.tsx'),
  ]);

  assert.match(storeSource, /export type SiteMaterial/);
  assert.match(storeSource, /export type SiteDocument/);
  assert.match(storeSource, /export type SitePhoto/);
  assert.match(storeSource, /materials: SiteMaterial\[\]/);
  assert.match(storeSource, /documents: SiteDocument\[\]/);
  assert.match(storeSource, /photos: SitePhoto\[\]/);
  assert.match(storeSource, /orderReferences: SiteOrderReference\[\]/);
  assert.match(storeSource, /deliveryReferences: SiteDeliveryReference\[\]/);
  assert.match(routeSource, /if \(Array\.isArray\(body\?\.materials\)\)/);
  assert.match(routeSource, /if \(Array\.isArray\(body\?\.documents\)\)/);
  assert.match(routeSource, /if \(Array\.isArray\(body\?\.photos\)\)/);
  assert.match(routeSource, /if \(Array\.isArray\(body\?\.orderReferences\)\)/);
  assert.match(routeSource, /if \(Array\.isArray\(body\?\.deliveryReferences\)\)/);
  assert.match(summaryRouteSource, /listPaymentStatuses/);
  assert.match(summaryRouteSource, /listAllDeliveries/);
  assert.match(panelSource, /id="materiaux"/);
  assert.match(panelSource, /fetch\(`\/api\/sites\/\$\{siteId\}\/summary`/);
  assert.match(panelSource, /id="commandes"/);
  assert.match(panelSource, /id="livraisons"/);
  assert.match(panelSource, /id="documents"/);
  assert.match(panelSource, /id="photos"/);
});

test('technician dashboard uses a persisted profile for photos, equipment and evaluations', async () => {
  const [storeSource, routeSource, panelSource] = await Promise.all([
    read('lib/technicianStore.ts'),
    read('app/api/technician/profile/route.ts'),
    read('components/monchantier/TechnicianServicesPanel.tsx'),
  ]);

  assert.match(storeSource, /export type TechnicianEquipment/);
  assert.match(storeSource, /export type TechnicianPhoto/);
  assert.match(storeSource, /export type TechnicianReview/);
  assert.match(storeSource, /addTechnicianEquipment/);
  assert.match(storeSource, /addTechnicianPhoto/);
  assert.match(storeSource, /addTechnicianReview/);
  assert.match(routeSource, /export async function GET/);
  assert.match(routeSource, /export async function POST/);
  assert.match(routeSource, /kind === 'equipment'/);
  assert.match(routeSource, /kind === 'photo'/);
  assert.match(routeSource, /kind === 'review'/);
  assert.match(panelSource, /fetch\("\/api\/technician\/profile"/);
  assert.match(panelSource, /id="photos"/);
  assert.match(panelSource, /id="materiel"/);
  assert.match(panelSource, /id="evaluations"/);
});
