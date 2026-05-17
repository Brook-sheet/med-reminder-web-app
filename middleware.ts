// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export const runtime = 'edge';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ||
    'fallback-secret-change-this-in-production-min-32'
);

// Pages that do NOT require login
const PUBLIC_ROUTES = ['/sign-in', '/sign-up'];
// ✅ Public API routes (ESP32 INCLUDED)
const PUBLIC_API_ROUTES = [
  '/api/auth',
  '/api/auth/login',
  '/api/auth/register',
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

  // ── ✅ Allow ALL ESP32 / sensor API routes (NO AUTH) ────────────────
  if (isPublicApi(pathname)) {
    return NextResponse.next();
  }

  // ── Check auth token ────────────────────────────────────────────────
  const token = request.cookies.get('med_auth_token')?.value;
  const user = token ? await verifyToken(token) : null;

  const isPublicPage = PUBLIC_ROUTES.some((r) =>
    pathname.startsWith(r)
  );

  // ── If logged in → block auth pages ────────────────────────────────
  if (user && isPublicPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── If NOT logged in → redirect only NON-public pages ──────────────
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