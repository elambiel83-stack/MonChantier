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

let assignTenantRole: typeof import('./tenantRoleStore').assignTenantRole;
let getTenantIdForIdentity: typeof import('./tenantRoleStore').getTenantIdForIdentity;
let getTenantRole: typeof import('./tenantRoleStore').getTenantRole;
let setTenantMemberActive: typeof import('./tenantRoleStore').setTenantMemberActive;
let listTenantMembers: typeof import('./tenantRoleStore').listTenantMembers;

beforeAll(async () => {
  ({ assignTenantRole, getTenantIdForIdentity, getTenantRole, setTenantMemberActive, listTenantMembers } = await import(
    './tenantRoleStore'
  ));
});

describe('assignTenantRole', () => {
  it('assigns a role and updates the identity→tenant index', async () => {
    const tenantId = `TNT-${Math.random()}`;
    const identity = `owner-${Math.random()}@example.com`;

    const result = await assignTenantRole({ tenantId, identity, role: 'owner', assignedBy: identity });
    expect(result.success).toBe(true);

    expect(await getTenantIdForIdentity(identity)).toBe(tenantId);
    expect(await getTenantRole(tenantId, identity)).toBe('owner');
  });

  it('refuses assigning a role in a different tenant than the one already joined', async () => {
    const tenantA = `TNT-A-${Math.random()}`;
    const tenantB = `TNT-B-${Math.random()}`;
    const identity = `person-${Math.random()}@example.com`;

    await assignTenantRole({ tenantId: tenantA, identity, role: 'member', assignedBy: 'admin@x.com' });
    const conflict = await assignTenantRole({ tenantId: tenantB, identity, role: 'member', assignedBy: 'admin@x.com' });

    expect(conflict).toEqual({ success: false, error: 'already_in_other_tenant' });
    expect(await getTenantIdForIdentity(identity)).toBe(tenantA);
  });

  it('allows re-assigning a different role within the same tenant', async () => {
    const tenantId = `TNT-${Math.random()}`;
    const identity = `promo-${Math.random()}@example.com`;

    await assignTenantRole({ tenantId, identity, role: 'member', assignedBy: 'owner@x.com' });
    const promoted = await assignTenantRole({ tenantId, identity, role: 'admin', assignedBy: 'owner@x.com' });

    expect(promoted.success).toBe(true);
    expect(await getTenantRole(tenantId, identity)).toBe('admin');
  });
});

describe('setTenantMemberActive', () => {
  it('deactivates a member so getTenantRole no longer returns their role', async () => {
    const tenantId = `TNT-${Math.random()}`;
    const identity = `member-${Math.random()}@example.com`;
    await assignTenantRole({ tenantId, identity, role: 'member', assignedBy: 'owner@x.com' });

    await setTenantMemberActive({ tenantId, identity, active: false });

    expect(await getTenantRole(tenantId, identity)).toBeNull();
  });

  it('returns null for an unknown member', async () => {
    expect(await setTenantMemberActive({ tenantId: 'unknown', identity: 'nobody@x.com', active: false })).toBeNull();
  });
});

describe('listTenantMembers', () => {
  it('lists all members of a tenant', async () => {
    const tenantId = `TNT-${Math.random()}`;
    await assignTenantRole({ tenantId, identity: 'a@x.com', role: 'owner', assignedBy: 'a@x.com' });
    await assignTenantRole({ tenantId, identity: 'b@x.com', role: 'member', assignedBy: 'a@x.com' });

    const members = await listTenantMembers(tenantId);
    expect(members).toHaveLength(2);
  });
});
