import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

test('site store provides automatic order and delivery linkage helpers', async () => {
  const source = await read('lib/siteStore.ts');

  assert.match(source, /function addressesLikelyMatch/);
  assert.match(source, /function backfillSiteReferences/);
  assert.match(source, /export function autoLinkOrderReferenceToSite/);
  assert.match(source, /export function autoLinkDeliveryReferenceToSite/);
  assert.match(source, /backfillSiteReferences\(site, payments, deliveries\)/);
});

test('payment confirmation auto-links matching sites for orders and deliveries', async () => {
  const source = await read('lib/paymentConfirmation.ts');

  assert.match(source, /autoLinkOrderReferenceToSite/);
  assert.match(source, /autoLinkDeliveryReferenceToSite/);
  assert.match(source, /if \(invoice\.deliveryAddress\)/);
  assert.match(source, /const delivery = await createDeliveryFromPayment/);
});

test('site manager dashboard explains automatic linkage with manual fallback', async () => {
  const source = await read('components/monchantier/SiteManagerPanel.tsx');

  assert.match(source, /reliées automatiquement quand l&apos;adresse correspond au chantier/);
  assert.match(source, /Ajoutez une référence si nécessaire/);
});
