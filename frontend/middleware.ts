import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Add paths that require authentication
const protectedPaths = ['/dashboard', '/profile'];

// Add paths that should redirect to home if already authenticated
const authPaths = ['/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the current path is protected
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path),
  );
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  // For now, we'll implement basic logic
  // In a real app, you'd check the session here

  if (isProtectedPath) {
    // You can add session checking logic here
    // For now, redirect to auth page
    const authUrl = new URL('/auth', request.url);
    authUrl.searchParams.set('callbackUrl', pathname);
    // return NextResponse.redirect(authUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
