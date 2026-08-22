import { NextRequest, NextResponse } from 'next/server';
import { getAppOrigin } from '@/lib/appUrl';
import {
  createGoogleAuthorizationRequest,
  getGoogleRedirectUri,
  GOOGLE_OAUTH_COOKIE_NAMES,
  GOOGLE_OAUTH_COOKIE_OPTIONS,
  isGoogleAuthConfigured,
} from '@/lib/googleAuth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!isGoogleAuthConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: 'Google authentication is not configured.',
      },
      { status: 500 }
    );
  }

  try {
    const appOrigin = getAppOrigin(request);
    const redirectUri = getGoogleRedirectUri(appOrigin);

    const {
      url,
      state,
      verifier,
      nonce,
    } = createGoogleAuthorizationRequest(redirectUri);

    const response = NextResponse.redirect(url);

    response.cookies.set({
      ...GOOGLE_OAUTH_COOKIE_OPTIONS,
      name: GOOGLE_OAUTH_COOKIE_NAMES.state,
      value: state,
    });

    response.cookies.set({
      ...GOOGLE_OAUTH_COOKIE_OPTIONS,
      name: GOOGLE_OAUTH_COOKIE_NAMES.verifier,
      value: verifier,
    });

    response.cookies.set({
      ...GOOGLE_OAUTH_COOKIE_OPTIONS,
      name: GOOGLE_OAUTH_COOKIE_NAMES.nonce,
      value: nonce,
    });

    return response;
  } catch (error) {
    console.error('[GOOGLE_AUTH_START]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to start Google authentication.',
      },
      { status: 500 }
    );
  }
}