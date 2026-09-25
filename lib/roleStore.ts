import { AppRole } from "@/lib/roles";
import { readStore, withStore } from './storeDb';

export type RoleAssignment = { role: AppRole; active: boolean; assignedAt: string; assignedBy?: string; expiresAt?: string };
export type RoleAuditEvent = { at: string; actor: string; identity: string; action: 'assigned' | 'activated' | 'deactivated'; role?: AppRole };
type RoleStoreModel = { assignments: Record<string, RoleAssignment>; audit: RoleAuditEvent[] };

const STORE_KEY = 'role-store';
const buildInitialStore = (): RoleStoreModel => ({ assignments: {}, audit: [] });
const MAX_AUDIT_EVENTS = 5_000;

export function normalizeIdentity(identity: string): string { return identity.trim().toLowerCase(); }
function appendAudit(store: RoleStoreModel, event: RoleAuditEvent) { store.audit.unshift(event); store.audit.length = Math.min(store.audit.length, MAX_AUDIT_EVENTS); }

export function isAssignmentActive(assignment: RoleAssignment | null | undefined): boolean {
  return Boolean(assignment?.active && (!assignment.expiresAt || new Date(assignment.expiresAt).getTime() > Date.now()));
}
export async function getRoleAssignment(identity: string): Promise<RoleAssignment | null> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.assignments[normalizeIdentity(identity)] || null;
}
export async function getStoredRole(identity: string): Promise<AppRole | null> {
  const assignment = await getRoleAssignment(identity);
  return isAssignmentActive(assignment) ? assignment!.role : null;
}
export async function isIdentityActive(identity: string): Promise<boolean> {
  const assignment = await getRoleAssignment(identity);
  return !assignment || isAssignmentActive(assignment);
}
export function setStoredRole(args: { identity: string; role: AppRole; actor: string; expiresAt?: string }): Promise<RoleAssignment> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const identity = normalizeIdentity(args.identity); const assignedAt = new Date().toISOString();
    const assignment: RoleAssignment = { role: args.role, active: true, assignedAt, assignedBy: normalizeIdentity(args.actor), expiresAt: args.expiresAt };
    store.assignments[identity] = assignment;
    appendAudit(store, { at: assignedAt, actor: assignment.assignedBy!, identity, action: 'assigned', role: args.role });
    return assignment;
  });
}
export function setIdentityActive(args: { identity: string; active: boolean; actor: string }): Promise<RoleAssignment | null> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const identity = normalizeIdentity(args.identity); const assignment = store.assignments[identity];
    if (!assignment) return null;
    assignment.active = args.active;
    appendAudit(store, { at: new Date().toISOString(), actor: normalizeIdentity(args.actor), identity, action: args.active ? 'activated' : 'deactivated', role: assignment.role });
    return assignment;
  });
}
export async function listStoredRoles(): Promise<Record<string, RoleAssignment>> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.assignments;
}
export async function listRoleAudit(): Promise<RoleAuditEvent[]> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return [...store.audit];
}
