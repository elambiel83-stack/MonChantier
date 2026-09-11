import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = '/home/runner/work/MonChantier/MonChantier';

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

function extractCreditAgentAnchors(source) {
  const blockMatch = source.match(/"credit-agent":\s*\[(.*?)\n\s*\],\n\s*"credit-committee":/s);
  assert.ok(blockMatch, 'Credit-agent block should exist in lib/roles.ts');
  return [...blockMatch[1].matchAll(/anchor:\s*"([^"]+)"/g)].map((match) => match[1]);
}

test('credit-agent menu uses dedicated anchors', async () => {
  const rolesSource = await read('lib/roles.ts');
  assert.deepEqual(extractCreditAgentAnchors(rolesSource), ['dossiers-assignes', 'analyse', 'recouvrement']);
});

test('credit-agent dashboard contains every anchored section', async () => {
  const [rolesSource, panelSource] = await Promise.all([
    read('lib/roles.ts'),
    read('components/monchantier/CreditAgentPanel.tsx'),
  ]);

  const anchors = extractCreditAgentAnchors(rolesSource);
  const sectionIds = new Set([...panelSource.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));

  for (const anchor of anchors) {
    assert.ok(sectionIds.has(anchor), `Missing credit-agent section id="${anchor}"`);
  }
});

test('credit-agent dashboard separates review and collection actions', async () => {
  const panelSource = await read('components/monchantier/CreditAgentPanel.tsx');

  assert.match(panelSource, /loan\.status === "submitted"/);
  assert.match(panelSource, /id="analyse"/);
  assert.match(panelSource, /id="recouvrement"/);
  assert.match(panelSource, /loan\.repaymentHealth === "late" \|\| loan\.repaymentHealth === "defaulted"/);
  assert.match(panelSource, /logCollection\(loan\.id, "called"\)/);
});
