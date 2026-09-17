import { NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { getTenantIdForIdentity, assignTenantRole } from '@/lib/tenantRoleStore';
import { createTenant, isValidSlug } from '@/lib/tenantStore';

/**
 * Onboarding self-service : n'importe quel compte connecté (Google,
 * Facebook, téléphone...) peut créer sa propre organisation et en devient
 * automatiquement le premier owner. Contrainte MVP : une identité ne peut
 * appartenir qu'à un seul tenant (voir lib/tenantRoleStore.ts).
 */
export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });

  const existingTenantId = await getTenantIdForIdentity(actor.identity);
  if (existingTenantId) {
    return NextResponse.json({ message: 'Ce compte appartient déjà à une organisation' }, { status: 409 });
  }

  const body = await request.json();
  const slug = String(body?.slug || '').trim().toLowerCase();
  const name = String(body?.name || '').trim();
  const seller = body?.seller || {};
  const companyName = String(seller?.companyName || name).trim();
  const address = String(seller?.address || '').trim();
  const city = String(seller?.city || '').trim();
  const country = String(seller?.country || '').trim();

  if (!isValidSlug(slug)) {
    return NextResponse.json(
      { message: 'Identifiant invalide (3-40 caractères, lettres minuscules/chiffres/tirets)' },
      { status: 400 }
    );
  }
  if (!name || !companyName || !address || !city || !country) {
    return NextResponse.json(
      { message: 'Nom de l\'organisation et identité (adresse, ville, pays) requis' },
      { status: 400 }
    );
  }

  const result = await createTenant({
    slug,
    name,
    seller: { companyName, address, city, country },
  });
  if (!result.success) {
    return NextResponse.json({ message: 'Cet identifiant est déjà pris' }, { status: 409 });
  }

  await assignTenantRole({
    tenantId: result.tenant.id,
    identity: actor.identity,
    role: 'owner',
    assignedBy: actor.identity,
  });

  return NextResponse.json({ success: true, tenant: result.tenant });
}
