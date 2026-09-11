import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = '/home/runner/work/MonChantier/MonChantier';

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

function extractAdminAnchors(source) {
  const adminBlockMatch = source.match(/admin:\s*\[(.*?)\n\s*\],\n\s*ai:/s);
  assert.ok(adminBlockMatch, 'Admin block should exist in lib/roles.ts');

  return [...adminBlockMatch[1].matchAll(/anchor:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function extractSectionIds(source) {
  return new Set([...source.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
}

test('admin menu entries all expose anchors', async () => {
  const rolesSource = await read('lib/roles.ts');
  const adminBlockMatch = rolesSource.match(/admin:\s*\[(.*?)\n\s*\],\n\s*ai:/s);
  assert.ok(adminBlockMatch, 'Admin block should exist in lib/roles.ts');

  const entries = adminBlockMatch[1]
    .split('\n')
    .filter((line) => line.includes('{ fr:'));

  assert.ok(entries.length > 0, 'Admin block should contain entries');
  for (const entry of entries) {
    assert.match(entry, /anchor:\s*"[^"]+"/, `Missing anchor in admin entry: ${entry.trim()}`);
  }
});

test('admin dashboard contains every anchored admin section', async () => {
  const [rolesSource, adminPageSource] = await Promise.all([
    read('lib/roles.ts'),
    read('app/dashboard/admin/page.tsx'),
  ]);

  const adminAnchors = extractAdminAnchors(rolesSource);
  const sectionIds = extractSectionIds(adminPageSource);

  for (const anchor of adminAnchors) {
    assert.ok(sectionIds.has(anchor), `Missing admin section id="${anchor}" in admin dashboard`);
  }
});

test('admin dashboard loads expected admin data sources', async () => {
  const adminPageSource = await read('app/dashboard/admin/page.tsx');
  const expectedEndpoints = [
    '/api/admin/stats',
    '/api/admin/users',
    '/api/admin/roles',
    '/api/admin/orders',
    '/api/admin/products',
    '/api/admin/services',
    '/api/admin/taxes',
    '/api/deliveries',
    '/api/sites',
    '/api/credit/loans',
  ];

  for (const endpoint of expectedEndpoints) {
    assert.ok(
      adminPageSource.includes(`fetch('${endpoint}'`) || adminPageSource.includes(`fetch("${endpoint}"`),
      `Admin dashboard should load ${endpoint}`
    );
  }
});

test('mutable admin API routes are protected by requireAdmin', async () => {
  const protectedRoutes = [
    'app/api/admin/generate-demo/route.ts',
    'app/api/admin/orders/route.ts',
    'app/api/admin/orders/[reference]/route.ts',
    'app/api/admin/products/route.ts',
    'app/api/admin/products/[id]/route.ts',
    'app/api/admin/roles/route.ts',
    'app/api/admin/services/route.ts',
    'app/api/admin/services/[id]/route.ts',
    'app/api/admin/stats/route.ts',
    'app/api/admin/taxes/route.ts',
    'app/api/admin/users/route.ts',
  ];

  for (const routePath of protectedRoutes) {
    const source = await read(routePath);
    assert.match(source, /import\s+\{\s*requireAdmin\s*\}\s+from\s+'@\/lib\/requireAdmin'/);
    assert.match(source, /const denied = await requireAdmin\(request\)/);
  }
});
