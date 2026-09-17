import { createSubscriptionCheckoutSession, isStripeConfigured } from './stripe';
import { getTenantById, getTenantByStripeCustomerId, updateTenantBilling, Tenant, TenantPlan } from './tenantStore';
import { countTenantProducts } from './tenantCatalogStore';
import { withStore } from './storeDb';

const BILLING_WEBHOOK_STORE_KEY = 'tenant-billing-webhook-store';
const buildInitialWebhookStore = (): { processedEventIds: string[] } => ({ processedEventIds: [] });
const MAX_WEBHOOK_EVENT_IDS = 5000;

/**
 * Claim atomique dédié aux webhooks Stripe Billing (distinct du
 * dédoublonnage des paiements de commandes dans lib/paymentStore.ts, qui ne
 * concerne pas la facturation SaaS des tenants).
 */
export function claimBillingWebhookEvent(eventId: string): Promise<boolean> {
  return withStore(BILLING_WEBHOOK_STORE_KEY, buildInitialWebhookStore, (store) => {
    if (store.processedEventIds.includes(eventId)) return false;
    store.processedEventIds.push(eventId);
    if (store.processedEventIds.length > MAX_WEBHOOK_EVENT_IDS) {
      store.processedEventIds.splice(0, store.processedEventIds.length - MAX_WEBHOOK_EVENT_IDS);
    }
    return true;
  });
}

export function unclaimBillingWebhookEvent(eventId: string): Promise<void> {
  return withStore(BILLING_WEBHOOK_STORE_KEY, buildInitialWebhookStore, (store) => {
    const index = store.processedEventIds.indexOf(eventId);
    if (index !== -1) store.processedEventIds.splice(index, 1);
  });
}

// Limites d'usage par plan — exemple concret d'enforcement pour la
// facturation SaaS (voir README "Multi-tenant (SaaS)"). `null` = illimité.
export const PLAN_LIMITS: Record<TenantPlan, { maxProducts: number | null }> = {
  starter: { maxProducts: 20 },
  pro: { maxProducts: 500 },
  enterprise: { maxProducts: null },
};

export type LimitCheckResult = { allowed: boolean; limit: number | null; current: number };

export async function assertWithinProductLimit(tenantId: string): Promise<LimitCheckResult> {
  const tenant = await getTenantById(tenantId);
  const plan = tenant?.plan || 'starter';
  const limit = PLAN_LIMITS[plan].maxProducts;
  const current = await countTenantProducts(tenantId);

  if (limit === null) return { allowed: true, limit, current };
  return { allowed: current < limit, limit, current };
}

// Plans payants uniquement : 'starter' est gratuit, pas d'abonnement Stripe.
type PaidPlan = Extract<TenantPlan, 'pro' | 'enterprise'>;

function getPriceId(plan: PaidPlan): string | null {
  if (plan === 'pro') return process.env.STRIPE_PRICE_PRO || null;
  return process.env.STRIPE_PRICE_ENTERPRISE || null;
}

export function isTenantBillingConfigured(): boolean {
  return isStripeConfigured() && Boolean(process.env.STRIPE_PRICE_PRO) && Boolean(process.env.STRIPE_PRICE_ENTERPRISE);
}

export async function createTenantBillingCheckout(args: {
  tenant: Tenant;
  plan: PaidPlan;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> {
  const priceId = getPriceId(args.plan);
  if (!priceId) {
    throw new Error(`Prix Stripe non configuré pour le plan ${args.plan}`);
  }

  return createSubscriptionCheckoutSession({
    priceId,
    tenantId: args.tenant.id,
    plan: args.plan,
    customerEmail: args.tenant.stripeCustomerId ? undefined : args.customerEmail,
    existingCustomerId: args.tenant.stripeCustomerId,
    successUrl: args.successUrl,
    cancelUrl: args.cancelUrl,
  });
}

/**
 * Applique un événement de webhook Stripe Billing déjà vérifié (signature
 * validée par l'appelant — voir /api/webhooks/stripe-billing) à l'état de
 * facturation du tenant concerné.
 */
export async function applyStripeBillingEvent(event: {
  type: string;
  data: { object: Record<string, unknown> };
}): Promise<void> {
  const object = event.data.object;

  if (event.type === 'checkout.session.completed') {
    const tenantId = (object.client_reference_id as string) || (object.metadata as Record<string, string>)?.tenantId;
    const customerId = object.customer as string | undefined;
    const subscriptionId = object.subscription as string | undefined;
    const plan = (object.metadata as Record<string, string>)?.plan as TenantPlan | undefined;
    if (!tenantId || !customerId) return;

    await updateTenantBilling(tenantId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: 'active',
      plan: plan || 'pro',
    });
    return;
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const customerId = object.customer as string;
    const status = object.status as string;
    const tenant = await getTenantByStripeCustomerId(customerId);
    if (!tenant) return;

    const subscriptionStatus =
      event.type === 'customer.subscription.deleted'
        ? 'canceled'
        : status === 'active' || status === 'trialing'
        ? (status as 'active' | 'trialing')
        : status === 'past_due'
        ? 'past_due'
        : 'canceled';

    await updateTenantBilling(tenant.id, {
      subscriptionStatus,
      // Un abonnement annulé/impayé retombe sur le plan gratuit — pas de
      // dégradation "douce" au-delà pour ce MVP.
      plan: subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? tenant.plan : 'starter',
    });
  }
}
