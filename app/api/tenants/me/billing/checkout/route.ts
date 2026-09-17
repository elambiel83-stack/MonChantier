import { NextResponse } from 'next/server';
import { getTenantActor } from '@/lib/tenantSessionIdentity';
import { getTenantById } from '@/lib/tenantStore';
import { createTenantBillingCheckout, isTenantBillingConfigured } from '@/lib/tenantBilling';

export async function POST(request: Request) {
  const actor = await getTenantActor();
  if (!actor) return NextResponse.json({ message: 'Aucun tenant associé à ce compte' }, { status: 401 });
  if (actor.tenantRole !== 'owner') {
    return NextResponse.json({ message: 'Seul le owner peut gérer la facturation' }, { status: 403 });
  }

  if (!isTenantBillingConfigured()) {
    return NextResponse.json({ message: 'Facturation SaaS non configurée (STRIPE_PRICE_PRO/ENTERPRISE)' }, { status: 503 });
  }

  const body = await request.json();
  const plan = body?.plan;
  if (plan !== 'pro' && plan !== 'enterprise') {
    return NextResponse.json({ message: 'Plan invalide' }, { status: 400 });
  }

  const tenant = await getTenantById(actor.tenantId);
  if (!tenant) return NextResponse.json({ message: 'Tenant introuvable' }, { status: 404 });

  const origin = request.headers.get('origin') || new URL(request.url).origin;

  const checkout = await createTenantBillingCheckout({
    tenant,
    plan,
    customerEmail: actor.identity.includes('@') ? actor.identity : tenant.seller.email || '',
    successUrl: `${origin}/org/billing?checkout=success`,
    cancelUrl: `${origin}/org/billing?checkout=cancel`,
  });

  return NextResponse.json({ success: true, url: checkout.url });
}
