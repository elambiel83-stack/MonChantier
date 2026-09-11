import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

test('payment mobile money initiation always generates the reference server-side', async () => {
  const source = await read('app/api/payments/mobilemoney/initiate/route.ts');

  assert.match(source, /const reference = generatePaymentReference\('MM'\);/);
  assert.doesNotMatch(source, /tx_ref/);
});

test('payment mobile money initiation registers pending status before confirmation branch', async () => {
  const source = await read('app/api/payments/mobilemoney/initiate/route.ts');
  const pendingIndex = source.indexOf("await registerPendingPayment(reference, 'mobilemoney');");
  const confirmIndex = source.indexOf("if (providerResponse.status === 'confirmed') {");

  assert.notEqual(pendingIndex, -1, 'pending registration should exist');
  assert.notEqual(confirmIndex, -1, 'confirmed branch should exist');
  assert.ok(pendingIndex < confirmIndex, 'pending registration must happen before the confirmed branch');
});

test('payment routes no longer contain local demo checkout fallbacks', async () => {
  const [cardSource, paypalSource, mobileSource] = await Promise.all([
    read('app/api/payments/card/create-checkout/route.ts'),
    read('app/api/payments/paypal/create-order/route.ts'),
    read('app/api/payments/mobilemoney/initiate/route.ts'),
  ]);

  assert.match(cardSource, /Paiement carte indisponible/);
  assert.doesNotMatch(cardSource, /demo_/i);
  assert.match(paypalSource, /Paiement PayPal indisponible/);
  assert.doesNotMatch(paypalSource, /demo_/i);
  assert.match(mobileSource, /Paiement Mobile Money indisponible/);
  assert.doesNotMatch(mobileSource, /TXN-DEMO-/);
});

test('mobile money helper uses shared phone normalization and provider-aware status parsing', async () => {
  const source = await read('lib/mobileMoney.ts');

  assert.match(source, /export function normalizeMobileMoneyPhone/);
  assert.match(source, /AbortSignal\.timeout\(MOBILE_MONEY_TIMEOUT_MS\)/);
  assert.match(source, /if \(provider === 'generic'\)/);
  assert.match(source, /return normalizeStatus\(\s*extractSettlementStatus\(payload, data\) \|\|/s);
});

test('wallet deposit mobile money route reuses the shared phone normalizer', async () => {
  const [source, panelSource] = await Promise.all([
    read('app/api/wallet/deposit/mobilemoney/route.ts'),
    read('components/monchantier/WalletPanel.tsx'),
  ]);

  assert.match(source, /normalizeMobileMoneyPhone/);
  assert.match(source, /const phone = normalizeMobileMoneyPhone\(body\?\.phone\);/);
  assert.match(source, /const network = sanitizeNetwork\(body\?\.network\);/);
  assert.match(panelSource, /depositNetwork/);
  assert.match(panelSource, /id="deposit-network"/);
});

test('mobile money webhook route validates encoded payment payloads', async () => {
  const source = await read('app/api/webhooks/mobilemoney/route.ts');

  assert.match(source, /MOBILE_MONEY_WEBHOOK_SECRET/);
  assert.match(source, /hasProcessedWebhookEvent\('mobilemoney'/);
  assert.match(source, /decodeInvoicePayload/);
  assert.match(source, /decodeWalletDepositPayload/);
});

test('payment modal no longer sends caller-supplied mobile money references', async () => {
  const source = await read('components/monchantier/PaymentModal.tsx');
  const mobileMoneyBlock = source.match(/if \(selectedMethod === "mobilemoney"\) \{([\s\S]*?)return;/);

  assert.ok(mobileMoneyBlock, 'mobile money block should exist');
  assert.doesNotMatch(mobileMoneyBlock[1], /tx_ref/);
});
