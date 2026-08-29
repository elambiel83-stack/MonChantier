import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiAdmin = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');

  if (!isApiAdmin && !isAdminPage) {
    return NextResponse.next();
  }

  const adminEmails = getAdminEmails();
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const email = typeof token?.email === 'string' ? token.email.toLowerCase() : null;
  const isAllowed = Boolean(email && adminEmails.includes(email));

  if (isAllowed) {
    return NextResponse.next();
  }

  if (isApiAdmin) {
    return NextResponse.json({ message: 'Accès administrateur requis' }, { status: 403 });
  }

  const signInUrl = new URL('/auth/signin', request.url);
  signInUrl.searchParams.set('callbackUrl', pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin', '/api/admin/:path*'],
};
