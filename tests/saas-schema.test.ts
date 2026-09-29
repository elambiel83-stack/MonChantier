import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../db/saas-schema.sql', import.meta.url), 'utf8');
const tenantTables = [
  'memberships','customers','products','services','orders','order_items','payments','invoices',
  'sites','site_tasks','site_incidents','deliveries','expenses','wallets','wallet_transactions',
  'loans','support_tickets','audit_events',
];

describe('schéma SaaS multi-tenant', () => {
  it.each(tenantTables)('%s possède tenant_id et est inclus dans la politique RLS', (table) => {
    const create = new RegExp(`CREATE TABLE IF NOT EXISTS saas\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql)?.[1] || '';
    expect(create).toContain('tenant_id UUID NOT NULL');
    expect(sql).toContain(`'${table}'`);
  });

  it('force RLS et utilise le contexte transactionnel app.tenant_id', () => {
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("current_setting(''app.tenant_id'', true)");
    expect(sql).toContain('WITH CHECK');
  });

  it('conserve JSONB uniquement pour les réglages et instantanés extensibles', () => {
    expect(sql).toContain("settings JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(sql).toContain('snapshot JSONB NOT NULL');
  });
});
