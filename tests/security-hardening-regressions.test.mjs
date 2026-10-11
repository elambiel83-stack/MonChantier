import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

test('token-based auth guards fail closed when jwt parsing throws', async () => {
  const [middlewareSource, requireRoleSource] = await Promise.all([
    read('middleware.ts'),
    read('lib/requireRole.ts'),
  ]);

  assert.match(middlewareSource, /try\s*\{\s*token = await getToken\(/s);
  assert.match(middlewareSource, /catch\s*\(error\)\s*\{\s*console\.warn\('Impossible de lire le jeton middleware:'/s);
  assert.match(requireRoleSource, /try\s*\{\s*const token = await getToken\(/s);
  assert.match(requireRoleSource, /catch\s*\(error\)\s*\{\s*console\.warn\('Impossible de lire le jeton de session:'/s);
});

test('partner registration no longer logs raw submissions and now throttles requests', async () => {
  const [routeSource, componentSource] = await Promise.all([
    read('app/api/partners/register/route.ts'),
    read('components/monchantier/Partners.tsx'),
  ]);

  assert.match(routeSource, /checkRateLimit\(`partner-registration:/);
  assert.match(routeSource, /isValidEmail/);
  assert.doesNotMatch(routeSource, /Données complètes:/);
  assert.doesNotMatch(routeSource, /NOUVELLE INSCRIPTION PARTENAIRE/);
  assert.doesNotMatch(componentSource, /demo mode/i);
});

test('demo payment generation is blocked on production-like environments and CSP avoids production unsafe-eval', async () => {
  const [demoRouteSource, nextConfigSource] = await Promise.all([
    read('app/api/admin/generate-demo/route.ts'),
    read('next.config.js'),
  ]);

  assert.match(demoRouteSource, /function isProductionLike\(/);
  assert.match(demoRouteSource, /Route indisponible hors environnement de test/);
  assert.match(nextConfigSource, /const isDevelopment = process\.env\.NODE_ENV !== 'production'/);
  assert.match(nextConfigSource, /\$\{isDevelopment \? " 'unsafe-eval'" : ''\}/);
});
