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

async function importSecurityDashboardModule() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monchantier-security-dashboard-'));
  const dashboardSource = await read('lib/securityDashboard.ts');
  const dashboardOutput = ts
    .transpileModule(dashboardSource, {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    })
    .outputText
    .replace('@/lib/adminStore', './adminStore.mjs')
    .replace('@/lib/rateLimit', './rateLimit.mjs')
    .replace('@/lib/roleStore', './roleStore.mjs')
    .replace('@/lib/securityStore', './securityStore.mjs');

  await Promise.all([
    fs.writeFile(path.join(tempDir, 'securityDashboard.mjs'), dashboardOutput, 'utf8'),
    fs.writeFile(
      path.join(tempDir, 'adminStore.mjs'),
      `let users = [];
export function listUsers() { return users; }
export function __setUsers(value) { users = value; }
`,
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'rateLimit.mjs'),
      `let buckets = [];
export function listRateLimitBuckets() { return buckets; }
export function __setBuckets(value) { buckets = value; }
`,
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'roleStore.mjs'),
      `let assignments = {};
let audit = [];
export async function listStoredRoles() { return assignments; }
export async function listRoleAudit() { return audit; }
export function isAssignmentActive(assignment) {
  return Boolean(assignment?.active && (!assignment.expiresAt || new Date(assignment.expiresAt).getTime() > Date.now()));
}
export function __setAssignments(value) { assignments = value; }
export function __setAudit(value) { audit = value; }
`,
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'securityStore.mjs'),
      `let events = [];
export async function listSecurityEvents() { return events; }
export function __setEvents(value) { events = value; }
`,
      'utf8'
    ),
  ]);

  const [dashboard, adminStore, rateLimit, roleStore, securityStore] = await Promise.all([
    import(`file://${path.join(tempDir, 'securityDashboard.mjs')}`),
    import(`file://${path.join(tempDir, 'adminStore.mjs')}`),
    import(`file://${path.join(tempDir, 'rateLimit.mjs')}`),
    import(`file://${path.join(tempDir, 'roleStore.mjs')}`),
    import(`file://${path.join(tempDir, 'securityStore.mjs')}`),
  ]);

  return { dashboard, adminStore, rateLimit, roleStore, securityStore };
}

test('security store persists auth and throttling telemetry', async () => {
  const source = await read('lib/securityStore.ts');

  assert.match(source, /export type SecurityEventType/);
  assert.match(source, /otp_requested/);
  assert.match(source, /admin_login_rate_limited/);
  assert.match(source, /recordSecurityEvent/);
  assert.match(source, /listSecurityEvents/);
});

test('security dashboard aggregates full 24h telemetry and limits only displayed events', async () => {
  const { dashboard, adminStore, rateLimit, roleStore, securityStore } = await importSecurityDashboardModule();
  const now = Date.now();
  const recentInfoEvents = Array.from({ length: 31 }, (_, index) => ({
    id: `otp-${index}`,
    type: 'otp_requested',
    severity: 'info',
    createdAt: new Date(now - index * 60_000).toISOString(),
  }));
  const recentAlertEvents = [
    {
      id: 'verify-failed-1',
      type: 'otp_verify_failed',
      severity: 'warning',
      createdAt: new Date(now - 32 * 60_000).toISOString(),
    },
    {
      id: 'verify-failed-2',
      type: 'otp_verify_failed',
      severity: 'warning',
      createdAt: new Date(now - 33 * 60_000).toISOString(),
    },
    {
      id: 'admin-failed',
      type: 'admin_login_failed',
      severity: 'critical',
      createdAt: new Date(now - 34 * 60_000).toISOString(),
    },
    {
      id: 'admin-success',
      type: 'admin_login_succeeded',
      severity: 'info',
      createdAt: new Date(now - 35 * 60_000).toISOString(),
    },
  ];

  securityStore.__setEvents([
    ...recentInfoEvents,
    ...recentAlertEvents,
    {
      id: 'old-alert',
      type: 'admin_login_failed',
      severity: 'critical',
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);
  adminStore.__setUsers([
    { id: 'admin-1', active: true },
    { id: 'user-2', active: false },
  ]);
  rateLimit.__setBuckets([
    { key: 'otp:1', allowed: false, count: 5, max: 5, remaining: 0, retryAfterMs: 1200 },
    { key: 'otp:2', allowed: true, count: 1, max: 5, remaining: 4, retryAfterMs: 0 },
  ]);
  roleStore.__setAssignments({
    'admin@monchantier.cd': { role: 'admin', active: true, assignedAt: new Date(now).toISOString() },
    'director@monchantier.cd': { role: 'director', active: false, assignedAt: new Date(now).toISOString() },
    'client@monchantier.cd': { role: 'client', active: true, assignedAt: new Date(now).toISOString() },
  });
  roleStore.__setAudit(
    Array.from({ length: 12 }, (_, index) => ({
      at: new Date(now - index * 1000).toISOString(),
      actor: 'admin@monchantier.cd',
      identity: `user-${index}@monchantier.cd`,
      action: 'assigned',
      role: 'client',
    }))
  );

  const summary = await dashboard.buildSecurityDashboardSummary();

  assert.equal(summary.summary.inactiveUsers, 1);
  assert.equal(summary.summary.inactiveAssignments, 1);
  assert.equal(summary.summary.privilegedAssignments, 2);
  assert.equal(summary.summary.throttledSources, 1);
  assert.equal(summary.summary.alerts24h, 3);
  assert.equal(summary.authActivity.otpRequested24h, 31);
  assert.equal(summary.authActivity.otpFailures24h, 2);
  assert.equal(summary.authActivity.adminFailures24h, 1);
  assert.equal(summary.authActivity.adminSuccess24h, 1);
  assert.equal(summary.recentEvents.length, 30);
  assert.equal(summary.throttledBuckets.length, 1);
  assert.equal(summary.recentRoleAudit.length, 10);
});

test('authentication flows record security telemetry for the admin dashboard', async () => {
  const [authSource, phoneAuthSource, phoneRequestRouteSource] = await Promise.all([
    read('lib/auth.ts'),
    read('lib/phoneAuth.ts'),
    read('app/api/auth/phone/request-code/route.ts'),
  ]);

  assert.match(authSource, /recordSecurityEvent/);
  assert.match(authSource, /Array\.isArray\(forwardedFor\)/);
  assert.match(authSource, /verifyPhoneOtpWithContext/);
  assert.match(authSource, /admin_login_succeeded/);
  assert.match(authSource, /admin_login_failed/);
  assert.match(phoneAuthSource, /otp_verify_rate_limited/);
  assert.match(phoneAuthSource, /otp_verify_failed/);
  assert.match(phoneRequestRouteSource, /otp_request_rate_limited/);
  assert.match(phoneRequestRouteSource, /otp_requested/);
});
