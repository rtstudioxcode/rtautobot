import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions } from './lib/session';

const PROTECTED = ['/dashboard', '/bonustime', '/topup', '/account', '/wallet'];
const ADMIN_ONLY = ['/admin'];
const GUEST_ONLY = ['/login', '/register'];

export async function middleware(request: any) {
  const { pathname } = request.nextUrl;

  const session = await getIronSession<any>(request, NextResponse.next(), sessionOptions);
  const user = session?.user;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAdmin = ADMIN_ONLY.some((p) => pathname.startsWith(p));
  const isGuest = GUEST_ONLY.some((p) => pathname.startsWith(p));

  if ((isProtected || isAdmin) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isAdmin && user?.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isGuest && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/bonustime/:path*',
    '/topup/:path*',
    '/account/:path*',
    '/wallet/:path*',
    '/admin/:path*',
    '/login',
    '/register',
  ],
};
