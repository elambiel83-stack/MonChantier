import { promises as fs } from "fs";
import path from "path";
import { AppRole, isAppRole } from "@/lib/roles";

export type RoleAssignment = { role: AppRole; active: boolean; assignedAt: string; assignedBy?: string; expiresAt?: string };
export type RoleAuditEvent = { at: string; actor: string; identity: string; action: 'assigned' | 'activated' | 'deactivated'; role?: AppRole };
type RoleStoreModel = { assignments: Record<string, RoleAssignment>; audit: RoleAuditEvent[] };

const STORE_PATH = path.join(process.cwd(), "data", "role-store.json");
const INITIAL_STORE: RoleStoreModel = { assignments: {}, audit: [] };
const MAX_AUDIT_EVENTS = 5_000;
let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(() => undefined, () => undefined);
  return run;
}
async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try { await fs.access(STORE_PATH); } catch { await fs.writeFile(STORE_PATH, JSON.stringify(INITIAL_STORE, null, 2), "utf8"); }
}
export function normalizeIdentity(identity: string): string { return identity.trim().toLowerCase(); }
function parseStore(raw: string): RoleStoreModel {
  try {
    const parsed = JSON.parse(raw) as { roles?: Record<string, AppRole>; assignments?: Record<string, Partial<RoleAssignment>>; audit?: RoleAuditEvent[] };
    const assignments: Record<string, RoleAssignment> = {};
    const now = new Date().toISOString();
    for (const [identity, role] of Object.entries(parsed.roles || {})) {
      if (isAppRole(role)) assignments[normalizeIdentity(identity)] = { role, active: true, assignedAt: now };
    }
    for (const [identity, value] of Object.entries(parsed.assignments || {})) {
      if (isAppRole(value.role)) assignments[normalizeIdentity(identity)] = { role: value.role, active: value.active !== false, assignedAt: value.assignedAt || now, assignedBy: value.assignedBy, expiresAt: value.expiresAt };
    }
    return { assignments, audit: Array.isArray(parsed.audit) ? parsed.audit.slice(0, MAX_AUDIT_EVENTS) : [] };
  } catch { return { assignments: {}, audit: [] }; }
}
async function readStore(): Promise<RoleStoreModel> { await ensureStoreFile(); return parseStore(await fs.readFile(STORE_PATH, "utf8")); }
async function writeStore(store: RoleStoreModel) { await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8"); }
function appendAudit(store: RoleStoreModel, event: RoleAuditEvent) { store.audit.unshift(event); store.audit.length = Math.min(store.audit.length, MAX_AUDIT_EVENTS); }

export function isAssignmentActive(assignment: RoleAssignment | null | undefined): boolean {
  return Boolean(assignment?.active && (!assignment.expiresAt || new Date(assignment.expiresAt).getTime() > Date.now()));
}
export function getRoleAssignment(identity: string): Promise<RoleAssignment | null> {
  return withLock(async () => (await readStore()).assignments[normalizeIdentity(identity)] || null);
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
  return withLock(async () => {
    const store = await readStore(); const identity = normalizeIdentity(args.identity); const assignedAt = new Date().toISOString();
    const assignment: RoleAssignment = { role: args.role, active: true, assignedAt, assignedBy: normalizeIdentity(args.actor), expiresAt: args.expiresAt };
    store.assignments[identity] = assignment;
    appendAudit(store, { at: assignedAt, actor: assignment.assignedBy!, identity, action: 'assigned', role: args.role });
    await writeStore(store); return assignment;
  });
}
export function setIdentityActive(args: { identity: string; active: boolean; actor: string }): Promise<RoleAssignment | null> {
  return withLock(async () => {
    const store = await readStore(); const identity = normalizeIdentity(args.identity); const assignment = store.assignments[identity];
    if (!assignment) return null;
    assignment.active = args.active;
    appendAudit(store, { at: new Date().toISOString(), actor: normalizeIdentity(args.actor), identity, action: args.active ? 'activated' : 'deactivated', role: assignment.role });
    await writeStore(store); return assignment;
  });
}
export function listStoredRoles(): Promise<Record<string, RoleAssignment>> { return withLock(async () => (await readStore()).assignments); }
export function listRoleAudit(): Promise<RoleAuditEvent[]> { return withLock(async () => [...(await readStore()).audit]); }
