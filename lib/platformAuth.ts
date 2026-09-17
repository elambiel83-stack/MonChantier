import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Opérateur de la plateforme SaaS elle-même (toi, l'éditeur) — distinct des
// admins de chaque tenant (lib/tenantRoleStore.ts) et du RBAC global de
// l'app mono-tenant existante (ADMIN_EMAILS dans lib/auth.ts). Une personne
// peut cumuler ce statut avec n'importe quel autre rôle.
function getPlatformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requirePlatformAdmin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email || !getPlatformAdminEmails().includes(email)) return null;
  return email;
}
