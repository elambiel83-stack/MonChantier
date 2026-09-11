import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

function createSiteLinkingHarness(source) {
  const start = source.indexOf('function normalizeIdentity');
  const end = source.indexOf('async function ensureStoreFile');
  assert.notEqual(start, -1, 'Site linking helpers should exist');
  assert.notEqual(end, -1, 'Site linking helper block should be bounded');

  const helperSource = source
    .slice(start, end)
    .replace('function normalizeIdentity(value?: string)', 'function normalizeIdentity(value)')
    .replace('function normalizeAddress(value?: string)', 'function normalizeAddress(value)')
    .replace('function addressesLikelyMatch(left?: string, right?: string)', 'function addressesLikelyMatch(left, right)')
    .replace(
      /function addUniqueReference<T extends \{ reference: string; addedAt: string \}>\(\s*list: T\[\],\s*factory: \(\) => T\s*\)/,
      'function addUniqueReference(list, factory)'
    )
    .replace(
      /function findBestMatchingSiteIndex\(\s*sites: Site\[\],\s*input: \{ clientIdentity\?: string; address\?: string \}\s*\)/,
      'function findBestMatchingSiteIndex(sites, input)'
    )
    .replace(
      /function backfillSiteReferences\(\s*site: Site,\s*payments: Awaited<ReturnType<typeof listPaymentStatuses>>,\s*deliveries: Awaited<ReturnType<typeof listAllDeliveries>>\s*\)/,
      'function backfillSiteReferences(site, payments, deliveries)'
    );

  return new Function(`${helperSource}; return { addressesLikelyMatch, findBestMatchingSiteIndex, backfillSiteReferences };`)();
}

test('site store helpers normalize and match likely addresses', async () => {
  const source = await read('lib/siteStore.ts');
  const { addressesLikelyMatch, findBestMatchingSiteIndex } = createSiteLinkingHarness(source);

  assert.equal(addressesLikelyMatch('Avenue de la Libération, Kinshasa', 'avenue de la liberation kinshasa'), true);
  assert.equal(addressesLikelyMatch('Commune de Gombe', 'Limete'), false);
  assert.equal(
    findBestMatchingSiteIndex(
      [
        { address: 'Avenue Kasavubu 10', clientIdentity: 'other@example.com' },
        { address: 'Avenue Kasavubu 10', clientIdentity: 'client@example.com' },
      ],
      { address: 'Avenue Kasavubu 10', clientIdentity: 'client@example.com' }
    ),
    1
  );
});

test('site store backfill only links historical references for the same client', async () => {
  const source = await read('lib/siteStore.ts');
  const { backfillSiteReferences } = createSiteLinkingHarness(source);

  const siteWithoutClient = { address: 'Avenue Kasavubu 10', clientIdentity: '', orderReferences: [], deliveryReferences: [] };
  const payments = [
    {
      reference: 'CMD-1',
      updatedAt: '2026-09-11T00:00:00.000Z',
      fullInvoice: { deliveryAddress: 'Avenue Kasavubu 10', customerEmail: 'client@example.com' },
    },
  ];
  const deliveries = [
    {
      reference: 'LIV-1',
      createdAt: '2026-09-11T00:00:00.000Z',
      deliveryAddress: 'Avenue Kasavubu 10',
      clientIdentity: 'client@example.com',
    },
  ];

  assert.equal(backfillSiteReferences(siteWithoutClient, payments, deliveries), false);
  assert.deepEqual(siteWithoutClient.orderReferences, []);
  assert.deepEqual(siteWithoutClient.deliveryReferences, []);

  const siteWithClient = {
    address: 'Avenue Kasavubu 10',
    clientIdentity: 'client@example.com',
    orderReferences: [],
    deliveryReferences: [],
  };

  assert.equal(backfillSiteReferences(siteWithClient, payments, deliveries), true);
  assert.deepEqual(siteWithClient.orderReferences.map((entry) => entry.reference), ['CMD-1']);
  assert.deepEqual(siteWithClient.deliveryReferences.map((entry) => entry.reference), ['LIV-1']);
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
