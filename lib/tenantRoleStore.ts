import { readStore, tenantKey, withStore } from './storeDb';

// Rôles au sein d'un tenant SaaS (organisation cliente), indépendants du
// RBAC global historique de MonChantier (lib/roleStore.ts, qui reste
// utilisé tel quel par l'app mono-tenant existante — voir README
// "Multi-tenant (SaaS)" pour la portée de cette couche additive).
export type TenantRole = 'owner' | 'admin' | 'member';

export type TenantRoleAssignment = {
  tenantId: string;
  role: TenantRole;
  active: boolean;
  assignedAt: string;
  assignedBy?: string;
};

type TenantRoleStoreModel = { assignments: Record<string, TenantRoleAssignment> };

const STORE_BASE = 'tenant-role-store';
const buildInitialStore = (): TenantRoleStoreModel => ({ assignments: {} });

function normalizeIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

// Index global (hors scope d'un tenant précis) : une personne → le tenant
// auquel elle appartient actuellement. Limite MVP assumée : une identité
// n'est membre que d'un seul tenant à la fois (pas de multi-organisation
// par utilisateur pour l'instant) — un futur passage à l'échelle
// remplacerait cet index par une vraie table relationnelle
// (identity, tenantId) sans unicité.
type IdentityTenantIndexModel = { byIdentity: Record<string, string> };
const INDEX_KEY = 'identity-tenant-index';
const buildInitialIndex = (): IdentityTenantIndexModel => ({ byIdentity: {} });

export async function getTenantIdForIdentity(identity: string): Promise<string | null> {
  const index = await readStore(INDEX_KEY, buildInitialIndex);
  return index.byIdentity[normalizeIdentity(identity)] || null;
}

export async function getTenantRoleAssignment(tenantId: string, identity: string): Promise<TenantRoleAssignment | null> {
  const store = await readStore(tenantKey(tenantId, STORE_BASE), buildInitialStore);
  return store.assignments[normalizeIdentity(identity)] || null;
}

export async function getTenantRole(tenantId: string, identity: string): Promise<TenantRole | null> {
  const assignment = await getTenantRoleAssignment(tenantId, identity);
  return assignment?.active ? assignment.role : null;
}

export type AssignTenantRoleResult =
  | { success: true; assignment: TenantRoleAssignment }
  | { success: false; error: 'already_in_other_tenant' };

/**
 * Assigne un rôle à une identité dans un tenant, et met à jour l'index
 * identity→tenant. Refuse si l'identité appartient déjà activement à un
 * AUTRE tenant (contrainte MVP "un tenant par personne" ci-dessus) — sauf
 * si elle rejoint ce même tenant (changement de rôle) ou n'a pas encore de
 * tenant.
 */
export async function assignTenantRole(args: {
  tenantId: string;
  identity: string;
  role: TenantRole;
  assignedBy: string;
}): Promise<AssignTenantRoleResult> {
  const identity = normalizeIdentity(args.identity);
  const existingTenantId = await getTenantIdForIdentity(identity);
  if (existingTenantId && existingTenantId !== args.tenantId) {
    return { success: false, error: 'already_in_other_tenant' };
  }

  const assignment = await withStore(tenantKey(args.tenantId, STORE_BASE), buildInitialStore, (store) => {
    const now = new Date().toISOString();
    const record: TenantRoleAssignment = {
      tenantId: args.tenantId,
      role: args.role,
      active: true,
      assignedAt: now,
      assignedBy: normalizeIdentity(args.assignedBy),
    };
    store.assignments[identity] = record;
    return record;
  });

  await withStore(INDEX_KEY, buildInitialIndex, (index) => {
    index.byIdentity[identity] = args.tenantId;
  });

  return { success: true, assignment };
}

export function setTenantMemberActive(args: {
  tenantId: string;
  identity: string;
  active: boolean;
}): Promise<TenantRoleAssignment | null> {
  return withStore(tenantKey(args.tenantId, STORE_BASE), buildInitialStore, (store) => {
    const identity = normalizeIdentity(args.identity);
    const assignment = store.assignments[identity];
    if (!assignment) return null;
    assignment.active = args.active;
    return assignment;
  });
}

export async function listTenantMembers(tenantId: string): Promise<TenantRoleAssignment[]> {
  const store = await readStore(tenantKey(tenantId, STORE_BASE), buildInitialStore);
  return Object.values(store.assignments);
}
