import type { NextRequest } from 'next/server';

function normalizeOrigin(value: string): string {
  const url = new URL(value);

  if (url.hostname === '0.0.0.0' || url.hostname === '[::]' || url.hostname === '::') {
    url.hostname = 'localhost';
  }

  return url.origin;
}

export function getAppOrigin(request?: NextRequest): string {
  const configuredUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (configuredUrl) {
    return normalizeOrigin(configuredUrl);
  }

  if (process.env.VERCEL_URL) {
    return normalizeOrigin(`https://${process.env.VERCEL_URL}`);
  }

  if (process.env.RENDER_EXTERNAL_URL) {
    return normalizeOrigin(process.env.RENDER_EXTERNAL_URL);
  }

  if (request) {
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

    if (forwardedHost) {
      return normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
    }

    return normalizeOrigin(request.nextUrl.origin);
  }

  return 'http://localhost:3000';
}

export function getGoogleRedirectUri(request?: NextRequest): string {
  const configuredRedirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (configuredRedirectUri) {
    const url = new URL(configuredRedirectUri);

    if (url.hostname === '0.0.0.0' || url.hostname === '[::]' || url.hostname === '::') {
      url.hostname = 'localhost';
    }

    return url.toString();
  }

  return new URL('/api/auth/google/callback', getAppOrigin(request)).toString();
}