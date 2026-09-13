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


async function importPhoneSecurityModules() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monchantier-phone-security-'));
  const [rateLimitSource, securityStoreSource, phoneAuthSource, serverStateStoreSource] = await Promise.all([
    read('lib/rateLimit.ts'),
    read('lib/securityStore.ts'),
    read('lib/phoneAuth.ts'),
    read('lib/serverStateStore.ts'),
  ]);

  const rateLimitOutput = ts.transpileModule(rateLimitSource, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const securityStoreOutput = ts.transpileModule(securityStoreSource, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace('./serverStateStore', './serverStateStore.mjs');
  const serverStateStoreOutput = ts.transpileModule(serverStateStoreSource, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const phoneAuthOutput = ts
    .transpileModule(phoneAuthSource, {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    })
    .outputText
    .replace('./serverStateStore', './serverStateStore.mjs')
    .replace('./rateLimit', './rateLimit.mjs')
    .replace('./securityStore', './securityStore.mjs');

  await Promise.all([
    fs.writeFile(path.join(tempDir, 'rateLimit.mjs'), rateLimitOutput, 'utf8'),
    fs.writeFile(path.join(tempDir, 'securityStore.mjs'), securityStoreOutput, 'utf8'),
    fs.writeFile(path.join(tempDir, 'serverStateStore.mjs'), serverStateStoreOutput, 'utf8'),
    fs.writeFile(path.join(tempDir, 'phoneAuth.mjs'), phoneAuthOutput, 'utf8'),
  ]);

  const previousCwd = process.cwd();
  process.chdir(tempDir);
  try {
    const [phoneAuth, securityStore] = await Promise.all([
      import(`file://${path.join(tempDir, 'phoneAuth.mjs')}`),
      import(`file://${path.join(tempDir, 'securityStore.mjs')}`),
    ]);
    return { phoneAuth, securityStore, restore: () => process.chdir(previousCwd) };
  } catch (error) {
    process.chdir(previousCwd);
    throw error;
  }
}

async function importSecurityDashboardModule() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monchantier-security-dashboard-'));
  const [dashboardSource, securityConfigSource] = await Promise.all([
    read('lib/securityDashboard.ts'),
    read('lib/securityConfig.ts'),
  ]);
  const dashboardOutput = ts
    .transpileModule(dashboardSource, {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    })
    .outputText
    .replace('@/lib/adminStore', './adminStore.mjs')
    .replace('@/lib/rateLimit', './rateLimit.mjs')
    .replace('@/lib/roleStore', './roleStore.mjs')
    .replace('@/lib/securityStore', './securityStore.mjs')
    .replace('@/lib/securityConfig', './securityConfig.mjs');
  const securityConfigOutput = ts.transpileModule(securityConfigSource, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  await Promise.all([
    fs.writeFile(path.join(tempDir, 'securityDashboard.mjs'), dashboardOutput, 'utf8'),
    fs.writeFile(path.join(tempDir, 'securityConfig.mjs'), securityConfigOutput, 'utf8'),
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

test('security store persists OTP failure and throttling telemetry with normalized identities', async () => {
  const { phoneAuth, securityStore, restore } = await importPhoneSecurityModules();

  try {
    const otp = await phoneAuth.createPhoneOtp('+243 900 000 001');
    assert.equal(await phoneAuth.verifyPhoneOtpWithContext(otp.phone, '000000', { ip: '2001:DB8::1' }), false);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await phoneAuth.verifyPhoneOtpWithContext(otp.phone, '111111', { ip: '2001:DB8::1' });
    }

    const secondOtp = await phoneAuth.createPhoneOtp('+243 900 000 002');
    assert.equal(await phoneAuth.verifyPhoneOtpWithContext(secondOtp.phone, secondOtp.code, { ip: '198.51.100.10' }), true);

    const events = await securityStore.listSecurityEvents();
    assert.equal(events[0].type, 'otp_verified');
    assert.equal(events[0].identity, '+243900000002');
    assert.equal(events[0].ip, '198.51.100.10');
    assert.equal(events[1].type, 'otp_verify_rate_limited');
    assert.equal(events[1].identity, '+243900000001');
    assert.equal(events[1].ip, '2001:DB8::1');
    assert.match(events[1].detail, /Retry in/);
    assert.equal(events.some((event) => event.type === 'otp_verify_failed'), true);
  } finally {
    restore();
  }
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
    {
      id: 'old-alert',
      type: 'admin_login_failed',
      severity: 'critical',
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    ...recentAlertEvents.reverse(),
    ...recentInfoEvents.reverse(),
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
      at: new Date(now - (11 - index) * 1000).toISOString(),
      actor: 'admin@monchantier.cd',
      identity: `user-${index}@monchantier.cd`,
      action: 'assigned',
      role: 'client',
    }))
  );

  const summary = await dashboard.buildSecurityDashboardSummary();

  assert.equal(summary.summary.inactiveUsers, 1);
  assert.equal(summary.summary.inactiveAssignments, 1);
  assert.equal(summary.summary.privilegedAssignments, 1);
  assert.equal(summary.summary.throttledSources, 1);
  assert.equal(summary.summary.alerts24h, 3);
  assert.equal(summary.authActivity.otpRequested24h, 31);
  assert.equal(summary.authActivity.otpFailures24h, 2);
  assert.equal(summary.authActivity.adminFailures24h, 1);
  assert.equal(summary.authActivity.adminSuccess24h, 1);
  assert.equal(summary.authActivity.webhookRejected24h, 0);
  assert.equal(summary.authActivity.manualPaymentDenied24h, 0);
  assert.equal(summary.configuration.environment, process.env.NODE_ENV || 'unknown');
  assert.equal(summary.recentEvents.length, 30);
  assert.equal(summary.recentEvents[0].id, 'otp-0');
  assert.equal(summary.throttledBuckets.length, 1);
  assert.equal(summary.recentRoleAudit.length, 10);
  assert.equal(summary.recentRoleAudit[0].identity, 'user-11@monchantier.cd');
});

test('authentication flows record security telemetry for the admin dashboard', async () => {
  const [authSource, phoneAuthSource, phoneRequestRouteSource, confirmRouteSource, stripeWebhookSource, paypalWebhookSource, mobileMoneyWebhookSource, usersRouteSource, rolesRouteSource] = await Promise.all([
    read('lib/auth.ts'),
    read('lib/phoneAuth.ts'),
    read('app/api/auth/phone/request-code/route.ts'),
    read('app/api/payments/confirm/route.ts'),
    read('app/api/webhooks/stripe/route.ts'),
    read('app/api/webhooks/paypal/route.ts'),
    read('app/api/webhooks/mobilemoney/route.ts'),
    read('app/api/admin/users/route.ts'),
    read('app/api/admin/roles/route.ts'),
  ]);

  assert.match(authSource, /recordSecurityEvent/);
  assert.match(authSource, /Array\.isArray\(forwardedFor\)/);
  assert.match(authSource, /verifyPhoneOtpWithContext/);
  assert.match(authSource, /admin_login_succeeded/);
  assert.match(authSource, /admin_login_failed/);
  assert.match(phoneAuthSource, /otp_verify_rate_limited/);
  assert.match(phoneAuthSource, /otp_verify_failed/);
  assert.match(phoneAuthSource, /revokePhoneOtp/);
  assert.match(phoneRequestRouteSource, /otp_request_rate_limited/);
  assert.match(phoneRequestRouteSource, /otp_requested/);
  assert.match(phoneRequestRouteSource, /ALLOW_OTP_DEBUG_CODE/);
  assert.match(phoneRequestRouteSource, /Service OTP indisponible: configuration SMS requise/);
  assert.match(confirmRouteSource, /manual_payment_denied/);
  assert.match(confirmRouteSource, /manual_payment_confirmed/);
  assert.match(confirmRouteSource, /admin-payment-confirm:/);
  assert.match(stripeWebhookSource, /webhook_rejected/);
  assert.match(stripeWebhookSource, /webhook_processed/);
  assert.match(paypalWebhookSource, /webhook_rejected/);
  assert.match(paypalWebhookSource, /webhook_processed/);
  assert.match(mobileMoneyWebhookSource, /webhook_rejected/);
  assert.match(mobileMoneyWebhookSource, /webhook_processed/);
  assert.match(usersRouteSource, /role_assignment_changed/);
  assert.match(usersRouteSource, /user_access_changed/);
  assert.match(rolesRouteSource, /role_assignment_changed/);
});

test('security config summary flags missing secrets and risky sandbox toggles', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monchantier-security-config-'));
  const source = await read('lib/securityConfig.ts');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  await fs.writeFile(path.join(tempDir, 'securityConfig.mjs'), output, 'utf8');
  const keys = [
    'NODE_ENV',
    'ALLOW_OTP_DEBUG_CODE',
    'ALLOW_SMS_SANDBOX',
    'AFRICASTALKING_USERNAME',
    'AFRICASTALKING_API_KEY',
    'NEXTAUTH_SECRET',
    'ADMIN_LOGIN_EMAIL',
    'ADMIN_LOGIN_PASSWORD',
    'ADMIN_TOTP_SECRET',
    'ADMIN_API_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_WEBHOOK_ID',
    'PAYPAL_API_BASE',
    'MOBILE_MONEY_API_KEY',
    'MOBILE_MONEY_WEBHOOK_SECRET',
  ];
  const previousEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.NODE_ENV = 'production';
  process.env.ALLOW_OTP_DEBUG_CODE = 'true';
  process.env.ALLOW_SMS_SANDBOX = 'true';
  process.env.AFRICASTALKING_USERNAME = 'sandbox';
  process.env.NEXTAUTH_SECRET = '';
  process.env.ADMIN_LOGIN_EMAIL = '';
  process.env.ADMIN_LOGIN_PASSWORD = '';
  process.env.ADMIN_TOTP_SECRET = '';
  process.env.ADMIN_API_SECRET = '';
  process.env.STRIPE_SECRET_KEY = '';
  process.env.STRIPE_WEBHOOK_SECRET = '';
  process.env.PAYPAL_CLIENT_ID = '';
  process.env.PAYPAL_CLIENT_SECRET = '';
  process.env.PAYPAL_WEBHOOK_ID = '';
  process.env.PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';
  process.env.MOBILE_MONEY_API_KEY = '';
  process.env.MOBILE_MONEY_WEBHOOK_SECRET = '';
  process.env.AFRICASTALKING_API_KEY = '';

  try {
    const { buildSecurityConfigSummary } = await import(`file://${path.join(tempDir, 'securityConfig.mjs')}`);
    const summary = buildSecurityConfigSummary();
    assert.equal(summary.environment, 'production');
    assert.equal(summary.issues.some((issue) => issue.id === 'otp-debug-enabled'), true);
    assert.equal(summary.issues.some((issue) => issue.id === 'sms-sandbox-enabled'), true);
    assert.equal(summary.issues.some((issue) => issue.id === 'paypal-sandbox-base'), true);
    assert.equal(summary.issues.some((issue) => issue.id === 'mobile-money-webhook-secret-missing'), true);
  } finally {
    for (const key of keys) {
      if (previousEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousEnv[key];
      }
    }
  }
});
