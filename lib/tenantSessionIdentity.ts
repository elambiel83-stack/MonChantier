import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { TenantRole } from '@/lib/tenantRoleStore';
import { getTenantById } from '@/lib/tenantStore';

export type TenantActor = {
  identity: string;
  tenantId: string;
  tenantRole: TenantRole;
};

/**
 * Équivalent tenant-scoped de lib/sessionIdentity.ts::getSessionActor(),
 * pour les routes de la couche SaaS additive (voir README). Retourne null
 * si l'identité connectée n'appartient à aucun tenant, ou si ce tenant est
 * suspendu (voir /api/platform/tenants/[id], console super-admin) : le
 * statut vit en base, pas dans le JWT, donc une suspension prend effet
 * immédiatement sans attendre l'expiration de la session.
 */
export async function getTenantActor(): Promise<TenantActor | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const identity = user?.identity || user?.email;
  if (!identity || !user?.tenantId || !user?.tenantRole) return null;

  const tenant = await getTenantById(user.tenantId);
  if (!tenant || tenant.status !== 'active') return null;

  return { identity: identity.toLowerCase(), tenantId: user.tenantId, tenantRole: user.tenantRole };
}
