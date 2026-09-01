import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { AppRole, isAppRole } from './roles';

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Independent, in-handler check for role-gated API routes. Defense-in-depth
 * alongside middleware.ts: this must not be the only gate on a route, but a
 * route must also never rely on middleware.ts alone. Admin always passes,
 * regardless of the roles list, since admin has platform-wide oversight.
 */
export async function requireRole(request: NextRequest, roles: AppRole[]): Promise<NextResponse | null> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const email = typeof token?.email === 'string' ? token.email.toLowerCase() : null;
  const role = isAppRole(token?.role) ? token.role : null;
  const isAdmin = role === 'admin' || (email !== null && getAdminEmails().includes(email));
  const allowed = isAdmin || (role !== null && roles.includes(role));

  if (!allowed) {
    return NextResponse.json({ message: 'Accès non autorisé' }, { status: 403 });
  }
  return null;
}
