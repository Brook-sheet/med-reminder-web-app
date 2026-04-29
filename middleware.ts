// middleware.ts  (project root)
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-this-in-production-min-32'
);

// Routes that DO NOT require authentication
const PUBLIC_ROUTES = ['/sign-in', '/sign-up'];
// API routes that are public (no JWT needed)
const PUBLIC_API_ROUTES = ['/api/auth/login', '/api/auth/register', '/api/sensor'];

async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Allow public API routes ────────────────────────────────────────────────
  if (PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // ── Allow Next.js internals & static files ─────────────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ── Get token from cookie ──────────────────────────────────────────────────
  const token = request.cookies.get('med_auth_token')?.value;
  const user = token ? await verifyToken(token) : null;

  const isPublicPage = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // ── Redirect authenticated users away from auth pages ─────────────────────
  if (user && isPublicPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── Redirect unauthenticated users to sign-in ─────────────────────────────
  if (!user && !isPublicPage) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};