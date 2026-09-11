import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

function extractAccountantAnchors(source) {
  const blockMatch = source.match(/accountant:\s*\[(.*?)\n\s*\],\n\s*director:/s);
  assert.ok(blockMatch, 'Accountant block should exist in lib/roles.ts');
  return [...blockMatch[1].matchAll(/anchor:\s*"([^"]+)"/g)].map((match) => match[1]);
}

test('accountant menu uses a dedicated export anchor', async () => {
  const rolesSource = await read('lib/roles.ts');
  assert.ok(extractAccountantAnchors(rolesSource).includes('export-comptable'));
});

test('accountant dashboard contains every anchored section', async () => {
  const [rolesSource, panelSource] = await Promise.all([
    read('lib/roles.ts'),
    read('components/monchantier/AccountantPanel.tsx'),
  ]);

  const anchors = extractAccountantAnchors(rolesSource);
  const sectionIds = new Set([...panelSource.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));

  for (const anchor of anchors) {
    assert.ok(sectionIds.has(anchor), `Missing accountant section id="${anchor}"`);
  }
});

test('accountant export section remains dedicated to CSV export', async () => {
  const panelSource = await read('components/monchantier/AccountantPanel.tsx');

  assert.match(panelSource, /id="export-comptable"/);
  assert.match(panelSource, /Export comptable \(CSV\)/);
  assert.match(panelSource, /Export CSV des factures confirmées/);
});
