import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

test('security store persists auth and throttling telemetry', async () => {
  const source = await read('lib/securityStore.ts');

  assert.match(source, /export type SecurityEventType/);
  assert.match(source, /otp_requested/);
  assert.match(source, /admin_login_rate_limited/);
  assert.match(source, /recordSecurityEvent/);
  assert.match(source, /listSecurityEvents/);
});

test('security dashboard aggregates telemetry, role audit and rate limits', async () => {
  const [dashboardSource, rateLimitSource] = await Promise.all([
    read('lib/securityDashboard.ts'),
    read('lib/rateLimit.ts'),
  ]);

  assert.match(dashboardSource, /listSecurityEvents/);
  assert.match(dashboardSource, /listStoredRoles/);
  assert.match(dashboardSource, /listRoleAudit/);
  assert.match(dashboardSource, /listRateLimitBuckets/);
  assert.match(rateLimitSource, /export function listRateLimitBuckets/);
});

test('authentication flows record security telemetry for the admin dashboard', async () => {
  const [authSource, phoneAuthSource, phoneRequestRouteSource] = await Promise.all([
    read('lib/auth.ts'),
    read('lib/phoneAuth.ts'),
    read('app/api/auth/phone/request-code/route.ts'),
  ]);

  assert.match(authSource, /recordSecurityEvent/);
  assert.match(authSource, /verifyPhoneOtpWithContext/);
  assert.match(authSource, /admin_login_succeeded/);
  assert.match(authSource, /admin_login_failed/);
  assert.match(phoneAuthSource, /otp_verify_rate_limited/);
  assert.match(phoneAuthSource, /otp_verify_failed/);
  assert.match(phoneRequestRouteSource, /otp_request_rate_limited/);
  assert.match(phoneRequestRouteSource, /otp_requested/);
});
