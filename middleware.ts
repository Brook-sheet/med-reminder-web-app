// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Updated for Next.js 16
export const runtime = 'experimental-edge';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ||
    'fallback-secret-change-this-in-production-min-32'
);

// Pages that do NOT require login
const PUBLIC_ROUTES = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password'];

// Of those, which ones a LOGGED-IN user should still be bounced away from
// (signing in/up again makes no sense once authenticated). Forgot/reset
// password are deliberately left off this list — someone might legitimately
// want to reset their password while still holding an active session on
// another device, so we don't force them out of that flow.
const AUTH_ONLY_ROUTES = ['/sign-in', '/sign-up'];

// Public API routes (ESP32 INCLUDED)
const PUBLIC_API_ROUTES = [
  '/api/auth',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/verify-reset-code',
  '/api/auth/reset-password',
  '/api/sensor',
  '/api/esp32',
  '/api/hardware',
];

function isPublicApi(pathname: string) {
  return PUBLIC_API_ROUTES.some((p) => pathname.startsWith(p));
}

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

  // ── Skip Next internals & static files ───────────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ── Allow ALL ESP32 / sensor API routes (NO AUTH) ───────────────────
  if (isPublicApi(pathname)) {
    return NextResponse.next();
  }

  // ── Check auth token ─────────────────────────────────────────────────
  const token = request.cookies.get('med_auth_token')?.value;

  const user = token ? await verifyToken(token) : null;

  const isPublicPage = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthOnlyPage = AUTH_ONLY_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // ── If logged in → block sign-in/sign-up (not forgot/reset-password) ──
  if (user && isAuthOnlyPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── If NOT logged in → redirect protected pages ──────────────────────
  if (!user && !isPublicPage) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('from', pathname);

    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};