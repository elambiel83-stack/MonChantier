import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { APP_ROLES, AppRole, isAppRole } from '@/lib/roles';

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function resolveRoleFromToken(request: NextRequest): Promise<AppRole | null> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return null;

  if (isAppRole(token.role)) return token.role;

  const email = typeof token.email === 'string' ? token.email.toLowerCase() : null;
  if (email && getAdminEmails().includes(email)) return 'admin';

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isApiAdmin = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  const isLegacyAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const dashboardMatch = pathname.match(/^\/dashboard(?:\/([^/]+))?/);

  if (!isApiAdmin && !isLegacyAdminPage && !dashboardMatch) {
    return NextResponse.next();
  }

  const role = await resolveRoleFromToken(request);

  if (isApiAdmin) {
    if (role === 'admin') return NextResponse.next();
    return NextResponse.json({ message: 'Accès administrateur requis' }, { status: 403 });
  }

  if (!role) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isLegacyAdminPage) {
    if (role !== 'admin') {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.redirect(new URL('/dashboard/admin', request.url));
  }

  const requestedRole = dashboardMatch?.[1];

  if (!requestedRole) {
    return NextResponse.redirect(new URL(`/dashboard/${role}`, request.url));
  }

  if (!(APP_ROLES as readonly string[]).includes(requestedRole)) {
    return NextResponse.redirect(new URL(`/dashboard/${role}`, request.url));
  }

  if (role !== 'admin' && role !== requestedRole) {
    return NextResponse.redirect(new URL(`/dashboard/${role}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/api/admin',
    '/api/admin/:path*',
    '/dashboard',
    '/dashboard/:path*',
  ],
};
