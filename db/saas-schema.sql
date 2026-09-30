-- MonChantier SaaS V2: données critiques relationnelles, réglages extensibles JSONB.
-- Cette couche est séparée de l'application historique et applique l'isolation
-- tenant côté PostgreSQL avec Row-Level Security (RLS).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS saas;

CREATE TABLE IF NOT EXISTS saas.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'none' CHECK (subscription_status IN ('none','trialing','active','past_due','canceled')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saas.memberships (
  tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  identity TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','accountant','site_manager','supplier','carrier','driver','support','member')),
  active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, identity)
);

CREATE TABLE IF NOT EXISTS saas.identity_directory (
  identity TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','accountant','site_manager','supplier','carrier','driver','support','member')),
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saas.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  identity TEXT, name TEXT NOT NULL, email TEXT, phone TEXT, address JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, identity)
);
CREATE TABLE IF NOT EXISTS saas.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL, name TEXT NOT NULL, price_minor BIGINT NOT NULL CHECK (price_minor >= 0), currency CHAR(3) NOT NULL,
  stock NUMERIC(18,3), active BOOLEAN NOT NULL DEFAULT true, settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (tenant_id, sku)
);
CREATE TABLE IF NOT EXISTS saas.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL, name TEXT NOT NULL, price_minor BIGINT CHECK (price_minor >= 0), currency CHAR(3), active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE TABLE IF NOT EXISTS saas.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  reference TEXT NOT NULL, customer_id UUID REFERENCES saas.customers(id), status TEXT NOT NULL DEFAULT 'draft',
  currency CHAR(3) NOT NULL, subtotal_minor BIGINT NOT NULL CHECK (subtotal_minor >= 0), tax_minor BIGINT NOT NULL CHECK (tax_minor >= 0),
  total_minor BIGINT NOT NULL CHECK (total_minor >= 0), delivery_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reference)
);
CREATE TABLE IF NOT EXISTS saas.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES saas.orders(id) ON DELETE CASCADE, product_id UUID REFERENCES saas.products(id), service_id UUID REFERENCES saas.services(id),
  description TEXT NOT NULL, quantity NUMERIC(18,3) NOT NULL CHECK (quantity > 0), unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
  total_minor BIGINT NOT NULL CHECK (total_minor >= 0), CHECK ((product_id IS NOT NULL)::int + (service_id IS NOT NULL)::int <= 1)
);
CREATE TABLE IF NOT EXISTS saas.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES saas.orders(id), reference TEXT NOT NULL, provider TEXT NOT NULL, provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending', amount_minor BIGINT NOT NULL CHECK (amount_minor > 0), currency CHAR(3) NOT NULL,
  verified_at TIMESTAMPTZ, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reference), UNIQUE (provider, provider_reference)
);
CREATE TABLE IF NOT EXISTS saas.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES saas.orders(id), payment_id UUID REFERENCES saas.payments(id), number TEXT NOT NULL,
  snapshot JSONB NOT NULL, issued_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (tenant_id, number)
);
CREATE TABLE IF NOT EXISTS saas.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  reference TEXT NOT NULL, name TEXT NOT NULL, customer_id UUID REFERENCES saas.customers(id), manager_identity TEXT,
  status TEXT NOT NULL DEFAULT 'planning', budget_minor BIGINT, currency CHAR(3), address JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reference)
);
CREATE TABLE IF NOT EXISTS saas.site_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES saas.sites(id) ON DELETE CASCADE, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'todo', assignee_identity TEXT,
  due_at TIMESTAMPTZ, settings JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saas.site_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES saas.sites(id) ON DELETE CASCADE, label TEXT NOT NULL, severity TEXT NOT NULL, resolved_at TIMESTAMPTZ,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saas.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES saas.orders(id), driver_identity TEXT, status TEXT NOT NULL DEFAULT 'pending',
  destination JSONB NOT NULL DEFAULT '{}'::jsonb, tracking JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saas.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  site_id UUID REFERENCES saas.sites(id), label TEXT NOT NULL, category TEXT NOT NULL, amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL, incurred_on DATE NOT NULL, evidence JSONB NOT NULL DEFAULT '{}'::jsonb, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saas.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES saas.customers(id), currency CHAR(3) NOT NULL, balance_minor BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (tenant_id, customer_id, currency)
);
CREATE TABLE IF NOT EXISTS saas.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES saas.wallets(id), amount_minor BIGINT NOT NULL CHECK (amount_minor <> 0), kind TEXT NOT NULL,
  reference TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (tenant_id, reference)
);
CREATE TABLE IF NOT EXISTS saas.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES saas.customers(id), reference TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'submitted',
  principal_minor BIGINT NOT NULL CHECK (principal_minor > 0), currency CHAR(3) NOT NULL, term_months INTEGER NOT NULL CHECK (term_months > 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (tenant_id, reference)
);
CREATE TABLE IF NOT EXISTS saas.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES saas.customers(id), subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saas.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  actor_identity TEXT NOT NULL, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Les tables de contrôle global ne sont pas soumises à RLS; toutes les tables
-- métier le sont. L'application doit exécuter SET LOCAL app.tenant_id dans une transaction.
DO $do$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['memberships','customers','products','services','orders','order_items','payments','invoices','sites','site_tasks','site_incidents','deliveries','expenses','wallets','wallet_transactions','loans','support_tickets','audit_events'] LOOP
    EXECUTE format('ALTER TABLE saas.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE saas.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON saas.%I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON saas.%I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)', t);
  END LOOP;
END $do$;

CREATE INDEX IF NOT EXISTS memberships_identity_idx ON saas.memberships(identity) WHERE active;
CREATE INDEX IF NOT EXISTS orders_tenant_customer_idx ON saas.orders(tenant_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_tenant_order_idx ON saas.payments(tenant_id, order_id);
CREATE INDEX IF NOT EXISTS sites_tenant_manager_idx ON saas.sites(tenant_id, manager_identity);
CREATE INDEX IF NOT EXISTS deliveries_tenant_driver_idx ON saas.deliveries(tenant_id, driver_identity);
CREATE INDEX IF NOT EXISTS audit_tenant_created_idx ON saas.audit_events(tenant_id, created_at DESC);
