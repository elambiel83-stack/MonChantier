import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newDb } from 'pg-mem';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mem = newDb({ autoCreateForeignKeyIndices: true });
const schema = readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
mem.public.none(schema);
const { Pool } = mem.adapters.createPg();
vi.mock('pg', () => ({ Pool }));
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

let createTenant: typeof import('./tenantStore').createTenant;
let getTenantById: typeof import('./tenantStore').getTenantById;
let getTenantBySlug: typeof import('./tenantStore').getTenantBySlug;
let setTenantStatus: typeof import('./tenantStore').setTenantStatus;
let updateTenantBilling: typeof import('./tenantStore').updateTenantBilling;
let getTenantByStripeCustomerId: typeof import('./tenantStore').getTenantByStripeCustomerId;
let isValidSlug: typeof import('./tenantStore').isValidSlug;

beforeAll(async () => {
  ({
    createTenant,
    getTenantById,
    getTenantBySlug,
    setTenantStatus,
    updateTenantBilling,
    getTenantByStripeCustomerId,
    isValidSlug,
  } = await import('./tenantStore'));
});

const seller = { companyName: 'Acme BTP', address: '1 rue X', city: 'Kinshasa', country: 'RDC' };

describe('isValidSlug', () => {
  it('accepts lowercase alphanumeric with dashes', () => {
    expect(isValidSlug('acme-btp')).toBe(true);
  });
  it('rejects uppercase, spaces, or too short', () => {
    expect(isValidSlug('Acme BTP')).toBe(false);
    expect(isValidSlug('ab')).toBe(false);
  });
});

describe('createTenant', () => {
  it('creates a tenant with defaults (starter plan, active, no subscription)', async () => {
    const result = await createTenant({ slug: `acme-${Math.random()}`, name: 'Acme', seller });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.tenant.plan).toBe('starter');
      expect(result.tenant.status).toBe('active');
      expect(result.tenant.subscriptionStatus).toBe('none');
    }
  });

  it('refuses a duplicate slug', async () => {
    const slug = `dup-${Math.random()}`;
    await createTenant({ slug, name: 'First', seller });
    const second = await createTenant({ slug, name: 'Second', seller });
    expect(second).toEqual({ success: false, error: 'slug_taken' });
  });

  it('is retrievable by id and by slug', async () => {
    const slug = `lookup-${Math.random()}`;
    const result = await createTenant({ slug, name: 'Lookup Co', seller });
    if (!result.success) throw new Error('setup failed');

    expect((await getTenantById(result.tenant.id))?.slug).toBe(slug);
    expect((await getTenantBySlug(slug))?.id).toBe(result.tenant.id);
    expect(await getTenantBySlug('does-not-exist')).toBeNull();
  });
});

describe('setTenantStatus', () => {
  it('suspends and reactivates a tenant', async () => {
    const result = await createTenant({ slug: `susp-${Math.random()}`, name: 'Susp Co', seller });
    if (!result.success) throw new Error('setup failed');

    const suspended = await setTenantStatus(result.tenant.id, 'suspended');
    expect(suspended?.status).toBe('suspended');

    const reactivated = await setTenantStatus(result.tenant.id, 'active');
    expect(reactivated?.status).toBe('active');
  });

  it('returns null for an unknown tenant', async () => {
    expect(await setTenantStatus('unknown', 'suspended')).toBeNull();
  });
});

describe('updateTenantBilling / getTenantByStripeCustomerId', () => {
  it('records Stripe identifiers and makes the tenant findable by customer id', async () => {
    const result = await createTenant({ slug: `bill-${Math.random()}`, name: 'Bill Co', seller });
    if (!result.success) throw new Error('setup failed');

    await updateTenantBilling(result.tenant.id, {
      plan: 'pro',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      subscriptionStatus: 'active',
    });

    const found = await getTenantByStripeCustomerId('cus_123');
    expect(found?.id).toBe(result.tenant.id);
    expect(found?.plan).toBe('pro');
    expect(found?.subscriptionStatus).toBe('active');
  });
});
