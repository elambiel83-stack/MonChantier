import { readStore, withStore } from './storeDb';

// Un "tenant" est une organisation cliente de la plateforme SaaS MonChantier
// (ex: une entreprise de matériaux de construction distincte). Remplace les
// identités globales en dur (BILLING_COMPANY_*, ADMIN_EMAILS) par une entité
// par organisation — voir README "Multi-tenant (SaaS)" pour la portée exacte
// de la migration (quels domaines sont déjà scopés par tenant).

export type TenantStatus = 'active' | 'suspended';
export type TenantPlan = 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';

export type TenantSellerIdentity = {
  companyName: string;
  address: string;
  city: string;
  country: string;
  phone?: string;
  email?: string;
  nif?: string;
  rccm?: string;
  idNat?: string;
  taxNumber?: string;
  vatNumber?: string;
  // % — remplace RDC_VAT_RATE (env var globale) par tenant. Absent = défaut
  // plateforme (voir lib/invoice.ts).
  vatRate?: number;
};

export type Tenant = {
  id: string;
  // Identifiant URL-safe unique, choisi à la création (ex: "acme-btp").
  slug: string;
  name: string;
  status: TenantStatus;
  plan: TenantPlan;
  seller: TenantSellerIdentity;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
};

type TenantStoreModel = { tenants: Tenant[] };

const STORE_KEY = 'tenant-store';
const buildInitialStore = (): TenantStoreModel => ({ tenants: [] });

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length >= 3 && slug.length <= 40;
}

function generateId() {
  return `TNT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listTenants(): Promise<Tenant[]> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.tenants;
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.tenants.find((t) => t.id === id) || null;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const normalized = slug.trim().toLowerCase();
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.tenants.find((t) => t.slug === normalized) || null;
}

export type CreateTenantResult = { success: true; tenant: Tenant } | { success: false; error: 'slug_taken' };

export function createTenant(input: {
  slug: string;
  name: string;
  seller: TenantSellerIdentity;
  plan?: TenantPlan;
}): Promise<CreateTenantResult> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const slug = input.slug.trim().toLowerCase();
    if (store.tenants.some((t) => t.slug === slug)) {
      return { success: false as const, error: 'slug_taken' as const };
    }

    const now = new Date().toISOString();
    const tenant: Tenant = {
      id: generateId(),
      slug,
      name: input.name,
      status: 'active',
      plan: input.plan || 'starter',
      seller: input.seller,
      subscriptionStatus: 'none',
      createdAt: now,
      updatedAt: now,
    };
    store.tenants.push(tenant);
    return { success: true as const, tenant };
  });
}

export function setTenantStatus(id: string, status: TenantStatus): Promise<Tenant | null> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const tenant = store.tenants.find((t) => t.id === id);
    if (!tenant) return null;
    tenant.status = status;
    tenant.updatedAt = new Date().toISOString();
    return tenant;
  });
}

export function updateTenantBilling(
  id: string,
  patch: Partial<Pick<Tenant, 'plan' | 'stripeCustomerId' | 'stripeSubscriptionId' | 'subscriptionStatus'>>
): Promise<Tenant | null> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const tenant = store.tenants.find((t) => t.id === id);
    if (!tenant) return null;
    Object.assign(tenant, patch, { updatedAt: new Date().toISOString() });
    return tenant;
  });
}

export async function getTenantByStripeCustomerId(stripeCustomerId: string): Promise<Tenant | null> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.tenants.find((t) => t.stripeCustomerId === stripeCustomerId) || null;
}
