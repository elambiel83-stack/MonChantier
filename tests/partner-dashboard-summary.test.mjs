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

async function importPartnerSummaryModule() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monchantier-partner-summary-'));
  const source = await read('lib/partnerDashboardSummary.ts');
  const output = ts
    .transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    })
    .outputText
    .replace('@/lib/paymentStore', './paymentStore.mjs')
    .replace('@/lib/productStore', './productStore.mjs')
    .replace('@/lib/quoteStore', './quoteStore.mjs')
    .replace('@/lib/serviceStore', './serviceStore.mjs');

  await Promise.all([
    fs.writeFile(path.join(tempDir, 'partnerDashboardSummary.mjs'), output, 'utf8'),
    fs.writeFile(path.join(tempDir, 'paymentStore.mjs'), 'export const StoredPaymentStatus = null;\n', 'utf8'),
    fs.writeFile(path.join(tempDir, 'productStore.mjs'), 'export const StoredProduct = null;\n', 'utf8'),
    fs.writeFile(path.join(tempDir, 'quoteStore.mjs'), 'export const StoredQuoteRequest = null;\n', 'utf8'),
    fs.writeFile(path.join(tempDir, 'serviceStore.mjs'), 'export const StoredService = null;\n', 'utf8'),
  ]);

  return import(`file://${path.join(tempDir, 'partnerDashboardSummary.mjs')}`);
}

test('technician summary counts only matched service totals for clients and revenue', async () => {
  const { buildTechnicianSummary } = await importPartnerSummaryModule();

  const summary = buildTechnicianSummary(
    [{ id: 1, fr: 'Plomberie', en: 'Plumbing', active: true }],
    [
      {
        reference: 'PAY-1',
        state: 'confirmed',
        method: 'card',
        updatedAt: '2026-09-11T12:00:00.000Z',
        orderStatus: 'processing',
        invoice: { email: 'client@example.com', totals: { currency: 'USD', ttc: 1000 } },
        fullInvoice: {
          customerEmail: 'client@example.com',
          customerName: 'Client A',
          currency: 'USD',
          totalTTC: 1000,
          items: [
            { productName: 'Plomberie', lineTotal: 100 },
            { productName: 'Ciment', lineTotal: 900 },
          ],
        },
      },
      {
        reference: 'PAY-2',
        state: 'confirmed',
        method: 'card',
        updatedAt: '2026-09-11T13:00:00.000Z',
        orderStatus: 'processing',
        invoice: { email: 'client@example.com', totals: { currency: 'USD', ttc: 250 } },
        fullInvoice: {
          customerEmail: 'client@example.com',
          customerName: 'Client A',
          currency: 'USD',
          totalTTC: 250,
          items: [
            { productName: 'Plomberie', lineTotal: 50 },
            { productName: 'Peinture', lineTotal: 200 },
          ],
        },
      },
    ],
    []
  );

  assert.deepEqual(summary.totals.revenueByCurrency, [['USD', 150]]);
  assert.equal(summary.totals.confirmedJobs, 2);
  assert.deepEqual(summary.clients[0].spendByCurrency, [['USD', 150]]);
  assert.deepEqual(summary.paymentsByMethod[0].totalsByCurrency, [['USD', 150]]);
  assert.deepEqual(summary.interventions[0].revenueByCurrency, [['USD', 150]]);
});
