import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { jwtVerify } from 'jose';

export const runtime =
  'experimental-edge';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ||
    'fallback-secret-change-this-in-production-min-32'
);

const PUBLIC_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/auth/google/callback',
];

const AUTH_ONLY_ROUTES = [
  '/sign-in',
  '/sign-up',
];

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
  '/api/medication-events',
];

function isPublicApi(pathname: string) {
  return PUBLIC_API_ROUTES.some(
    (route) =>
      pathname.startsWith(route)
  );
}

async function verifyToken(
  token: string
) {
  try {
    const { payload } = await jwtVerify(
      token,
      SECRET
    );

    return payload;
  } catch {
    return null;
  }
}

function forbidden(
  request: NextRequest,
  role: 'patient' | 'family'
) {
  if (
    request.nextUrl.pathname.startsWith(
      '/api/'
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Forbidden for this account role.',
      },
      {
        status: 403,
      }
    );
  }

  return NextResponse.redirect(
    new URL(
      role === 'family'
        ? '/monitor'
        : '/',
      request.url
    )
  );
}

export async function middleware(
  request: NextRequest
) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  if (isPublicApi(pathname)) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get(
      'med_auth_token'
    )?.value;

  const user = token
    ? await verifyToken(token)
    : null;

  const isPublicPage =
    PUBLIC_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

  const isAuthOnlyPage =
    AUTH_ONLY_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

  if (user && isAuthOnlyPage) {
    return NextResponse.redirect(
      new URL('/', request.url)
    );
  }

  if (!user && !isPublicPage) {
    const signInUrl = new URL(
      '/sign-in',
      request.url
    );

    signInUrl.searchParams.set(
      'from',
      pathname
    );

    return NextResponse.redirect(
      signInUrl
    );
  }

  if (user) {
    const role =
      user.role === 'family'
        ? 'family'
        : 'patient';

    const patientOnlyPages =
      pathname === '/' ||
      pathname.startsWith(
        '/medicines'
      ) ||
      pathname.startsWith(
        '/history'
      );

    const familyOnlyPages =
      pathname.startsWith(
        '/monitor'
      );

    const patientOnlyApis = [
      '/api/dashboard',
      '/api/medicines',
      '/api/history',
      '/api/adherence',
      '/api/upcoming',
      '/api/food-monitoring',
    ].some((prefix) =>
      pathname.startsWith(prefix)
    );

    if (
      role === 'family' &&
      (
        patientOnlyPages ||
        patientOnlyApis
      )
    ) {
      return forbidden(
        request,
        role
      );
    }

    if (
      role === 'patient' &&
      familyOnlyPages
    ) {
      return forbidden(
        request,
        role
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};