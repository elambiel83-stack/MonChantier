import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newDb } from 'pg-mem';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = newDb({ autoCreateForeignKeyIndices: true });
const schema = readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
mem.public.none(schema);
const { Pool } = mem.adapters.createPg();
vi.mock('pg', () => ({ Pool }));
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

vi.mock('./stripe', () => ({
  isStripeConfigured: vi.fn(() => true),
  createSubscriptionCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/test' })),
}));

let assertWithinProductLimit: typeof import('./tenantBilling').assertWithinProductLimit;
let createTenantBillingCheckout: typeof import('./tenantBilling').createTenantBillingCheckout;
let applyStripeBillingEvent: typeof import('./tenantBilling').applyStripeBillingEvent;
let claimBillingWebhookEvent: typeof import('./tenantBilling').claimBillingWebhookEvent;
let unclaimBillingWebhookEvent: typeof import('./tenantBilling').unclaimBillingWebhookEvent;
let createTenant: typeof import('./tenantStore').createTenant;
let getTenantById: typeof import('./tenantStore').getTenantById;
let createTenantProduct: typeof import('./tenantCatalogStore').createTenantProduct;

const seller = { companyName: 'Acme', address: 'x', city: 'Kinshasa', country: 'RDC' };

beforeEach(() => {
  process.env.STRIPE_PRICE_PRO = 'price_pro_test';
  process.env.STRIPE_PRICE_ENTERPRISE = 'price_enterprise_test';
});

beforeAll(async () => {
  ({ assertWithinProductLimit, createTenantBillingCheckout, applyStripeBillingEvent, claimBillingWebhookEvent, unclaimBillingWebhookEvent } =
    await import('./tenantBilling'));
  ({ createTenant, getTenantById } = await import('./tenantStore'));
  ({ createTenantProduct } = await import('./tenantCatalogStore'));
});

describe('assertWithinProductLimit', () => {
  it('allows creation under the starter plan limit (20)', async () => {
    const result = await createTenant({ slug: `lim-${Math.random()}`, name: 'Lim Co', seller });
    if (!result.success) throw new Error('setup failed');

    const check = await assertWithinProductLimit(result.tenant.id);
    expect(check).toEqual({ allowed: true, limit: 20, current: 0 });
  });

  it('blocks creation once the starter limit is reached', async () => {
    const result = await createTenant({ slug: `lim2-${Math.random()}`, name: 'Lim2 Co', seller });
    if (!result.success) throw new Error('setup failed');

    for (let i = 0; i < 20; i += 1) {
      await createTenantProduct(result.tenant.id, { name: `P${i}`, priceCents: 100, currency: 'USD' });
    }

    const check = await assertWithinProductLimit(result.tenant.id);
    expect(check.allowed).toBe(false);
    expect(check.current).toBe(20);
  });
});

describe('createTenantBillingCheckout', () => {
  it('delegates to Stripe with the tenant and plan context', async () => {
    const result = await createTenant({ slug: `chk-${Math.random()}`, name: 'Chk Co', seller });
    if (!result.success) throw new Error('setup failed');

    const checkout = await createTenantBillingCheckout({
      tenant: result.tenant,
      plan: 'pro',
      customerEmail: 'owner@example.com',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });

    expect(checkout.url).toBe('https://checkout.stripe.com/test');
  });

  it('throws when no price id is configured for the plan', async () => {
    const result = await createTenant({ slug: `chk2-${Math.random()}`, name: 'Chk2 Co', seller });
    if (!result.success) throw new Error('setup failed');
    delete process.env.STRIPE_PRICE_ENTERPRISE;

    await expect(
      createTenantBillingCheckout({
        tenant: result.tenant,
        plan: 'enterprise',
        customerEmail: 'owner@example.com',
        successUrl: 'https://app/success',
        cancelUrl: 'https://app/cancel',
      })
    ).rejects.toThrow(/Prix Stripe non configuré/);
  });
});

describe('applyStripeBillingEvent', () => {
  it('activates the subscription on checkout.session.completed', async () => {
    const result = await createTenant({ slug: `evt-${Math.random()}`, name: 'Evt Co', seller });
    if (!result.success) throw new Error('setup failed');

    await applyStripeBillingEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: result.tenant.id,
          customer: 'cus_abc',
          subscription: 'sub_abc',
          metadata: { tenantId: result.tenant.id, plan: 'pro' },
        },
      },
    });

    const tenant = await getTenantById(result.tenant.id);
    expect(tenant?.plan).toBe('pro');
    expect(tenant?.subscriptionStatus).toBe('active');
    expect(tenant?.stripeCustomerId).toBe('cus_abc');
  });

  it('reverts to the starter plan on subscription.deleted', async () => {
    const result = await createTenant({ slug: `evt2-${Math.random()}`, name: 'Evt2 Co', seller });
    if (!result.success) throw new Error('setup failed');

    await applyStripeBillingEvent({
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: result.tenant.id, customer: 'cus_xyz', metadata: { plan: 'pro' } } },
    });
    await applyStripeBillingEvent({
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_xyz', status: 'canceled' } },
    });

    const tenant = await getTenantById(result.tenant.id);
    expect(tenant?.subscriptionStatus).toBe('canceled');
    expect(tenant?.plan).toBe('starter');
  });

  it('ignores events for an unknown customer', async () => {
    await expect(
      applyStripeBillingEvent({
        type: 'customer.subscription.updated',
        data: { object: { customer: 'cus_unknown', status: 'active' } },
      })
    ).resolves.toBeUndefined();
  });
});

describe('claimBillingWebhookEvent / unclaimBillingWebhookEvent', () => {
  it('claims an event once and rejects a duplicate', async () => {
    const eventId = `evt-${Math.random()}`;
    expect(await claimBillingWebhookEvent(eventId)).toBe(true);
    expect(await claimBillingWebhookEvent(eventId)).toBe(false);
  });

  it('allows reclaiming after unclaim', async () => {
    const eventId = `evt-${Math.random()}`;
    await claimBillingWebhookEvent(eventId);
    await unclaimBillingWebhookEvent(eventId);
    expect(await claimBillingWebhookEvent(eventId)).toBe(true);
  });
});
