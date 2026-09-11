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
  const end = source.indexOf('async function readStore');
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

function createPaymentConfirmationHarness(source, overrides = {}) {
  const runtimeSource = source
    .slice(source.indexOf('function sanitizeCurrency'))
    .replace('function sanitizeCurrency(value: unknown)', 'function sanitizeCurrency(value)')
    .replace('function parsePositiveAmount(value: unknown)', 'function parsePositiveAmount(value)')
    .replace(
      'export function isSupportedMethod(value: unknown): value is InvoicePaymentMethod',
      'function isSupportedMethod(value)'
    )
    .replace('export function generatePaymentReference(prefix: string): string', 'function generatePaymentReference(prefix)')
    .replace(
      'export async function registerPendingPayment(reference: string, method: InvoicePaymentMethod)',
      'async function registerPendingPayment(reference, method)'
    )
    .replace('export async function getPaymentStatus(reference: string)', 'async function getPaymentStatus(reference)')
    .replace('export async function confirmPayment(payload: ConfirmPaymentPayload)', 'async function confirmPayment(payload)');

  const factory = new Function(
    'recordPayment',
    'buildInvoiceText',
    'createInvoice',
    'buildInvoicePdf',
    'isMailerConfigured',
    'sendInvoiceEmail',
    'getStoredPaymentStatus',
    'setStoredPaymentStatus',
    'createDeliveryFromPayment',
    'autoLinkDeliveryReferenceToSite',
    'autoLinkOrderReferenceToSite',
    'randomBytes',
    `${runtimeSource}; return { confirmPayment };`
  );

  return factory(
    overrides.recordPayment || (() => undefined),
    overrides.buildInvoiceText || (() => ''),
    overrides.createInvoice || ((payload) => payload),
    overrides.buildInvoicePdf || (async () => Buffer.from('')),
    overrides.isMailerConfigured || (() => false),
    overrides.sendInvoiceEmail || (async () => undefined),
    overrides.getStoredPaymentStatus || (async () => null),
    overrides.setStoredPaymentStatus || (async () => undefined),
    overrides.createDeliveryFromPayment || (async (payload) => payload),
    overrides.autoLinkDeliveryReferenceToSite || (async () => null),
    overrides.autoLinkOrderReferenceToSite || (async () => null),
    overrides.randomBytes || (() => Buffer.from('fixed-reference'))
  );
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
  assert.equal(
    findBestMatchingSiteIndex(
      [
        { address: 'Avenue Kasavubu 10', clientIdentity: 'client@example.com' },
        { address: 'Boulevard 30 Juin', clientIdentity: 'client@example.com' },
      ],
      { address: 'Adresse inconnue', clientIdentity: 'client@example.com' }
    ),
    -1
  );
  assert.equal(
    findBestMatchingSiteIndex([{ address: 'Avenue Kasavubu 10', clientIdentity: 'client@example.com' }], {
      address: 'Avenue Kasavubu 10',
      clientIdentity: 'other@example.com',
    }),
    -1
  );
  assert.equal(
    findBestMatchingSiteIndex([{ address: 'Avenue Kasavubu 10', clientIdentity: 'client@example.com' }], {
      address: 'Avenue Kasavubu 10',
    }),
    -1
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
  const linkedSite = {
    clientIdentity: 'client@example.com',
    address: 'Avenue Kasavubu 10',
    orderReferences: [],
    deliveryReferences: [],
  };
  const { confirmPayment } = createPaymentConfirmationHarness(source, {
    createInvoice: (payload) => ({
      standard: 'OHADA',
      legalReference: 'SYSCOHADA',
      invoiceNumber: 'INV-1',
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      taxRate: 16,
      totalHT: 100,
      totalTVA: 16,
      totalTTC: 116,
      currency: 'CDF',
      deliveryAddress: payload.deliveryAddress,
      location: payload.location,
    }),
    autoLinkOrderReferenceToSite: async ({ reference, clientIdentity, deliveryAddress }) => {
      if (clientIdentity === linkedSite.clientIdentity && deliveryAddress === linkedSite.address) {
        linkedSite.orderReferences.push(reference);
      }
      return linkedSite;
    },
    createDeliveryFromPayment: async ({ reference, clientIdentity, deliveryAddress }) => ({
      reference: `DEL-${reference}`,
      clientIdentity,
      deliveryAddress,
    }),
    autoLinkDeliveryReferenceToSite: async ({ reference, clientIdentity, deliveryAddress }) => {
      if (clientIdentity === linkedSite.clientIdentity && deliveryAddress === linkedSite.address) {
        linkedSite.deliveryReferences.push(reference);
      }
      return linkedSite;
    },
  });

  await confirmPayment({
    reference: 'PAY-1',
    method: 'mobilemoney',
    amount: 116,
    currency: 'CDF',
    customerName: 'Client MonChantier',
    customerEmail: linkedSite.clientIdentity,
    deliveryAddress: linkedSite.address,
  });

  assert.deepEqual(linkedSite.orderReferences, ['PAY-1']);
  assert.deepEqual(linkedSite.deliveryReferences, ['DEL-PAY-1']);
});

test('payment confirmation does not auto-link orders without matching client identity', async () => {
  const source = await read('lib/paymentConfirmation.ts');
  const linkedReferences = [];
  const { confirmPayment } = createPaymentConfirmationHarness(source, {
    createInvoice: (payload) => ({
      standard: 'OHADA',
      legalReference: 'SYSCOHADA',
      invoiceNumber: 'INV-2',
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      taxRate: 16,
      totalHT: 100,
      totalTVA: 16,
      totalTTC: 116,
      currency: 'CDF',
      deliveryAddress: payload.deliveryAddress,
      location: payload.location,
    }),
    autoLinkOrderReferenceToSite: async ({ reference }) => {
      linkedReferences.push(reference);
      return null;
    },
  });

  await confirmPayment({
    reference: 'PAY-2',
    method: 'mobilemoney',
    amount: 116,
    currency: 'CDF',
    customerName: 'Client MonChantier',
    deliveryAddress: 'Avenue Kasavubu 10',
  });

  assert.deepEqual(linkedReferences, []);
});

test('site manager dashboard explains automatic linkage with manual fallback', async () => {
  const source = await read('components/monchantier/SiteManagerPanel.tsx');

  assert.match(source, /reliées automatiquement quand l&apos;adresse correspond au chantier/);
  assert.match(source, /Ajoutez une référence si nécessaire/);
});
