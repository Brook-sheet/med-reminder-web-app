import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { generateUniquePatientId } from '@/lib/generatePatientId';
import { COOKIE_OPTIONS, signToken } from '@/lib/auth';
import { getAppOrigin } from '@/lib/appUrl';
import {
  exchangeGoogleCodeForIdentity,
  getGoogleRedirectUri,
  GOOGLE_OAUTH_COOKIE_NAMES,
  GOOGLE_OAUTH_COOKIE_OPTIONS,
  isGoogleAuthConfigured,
} from '@/lib/googleAuth';

export const runtime = 'nodejs';

function resultUrl(
  request: NextRequest,
  status: string,
  onboarding?: boolean
): URL {
  const url = new URL(
    '/auth/google/callback',
    getAppOrigin(request)
  );

  url.searchParams.set('status', status);

  if (onboarding !== undefined) {
    url.searchParams.set(
      'onboarding',
      onboarding ? 'required' : 'complete'
    );
  }

  return url;
}

function clearGoogleCookies(response: NextResponse): void {
  Object.values(GOOGLE_OAUTH_COOKIE_NAMES).forEach((name) => {
    response.cookies.set({
      ...GOOGLE_OAUTH_COOKIE_OPTIONS,
      name,
      value: '',
      maxAge: 0,
    });
  });
}

export async function GET(request: NextRequest) {
  const oauthError = request.nextUrl.searchParams.get('error');

  if (oauthError) {
    const response = NextResponse.redirect(
      resultUrl(
        request,
        oauthError === 'access_denied' ? 'cancelled' : 'error'
      )
    );

    clearGoogleCookies(response);
    return response;
  }

  if (!isGoogleAuthConfigured()) {
    const response = NextResponse.redirect(
      resultUrl(request, 'configuration_error')
    );

    clearGoogleCookies(response);
    return response;
  }

  const code =
    request.nextUrl.searchParams.get('code') || '';

  const returnedState =
    request.nextUrl.searchParams.get('state') || '';

  const storedState =
    request.cookies.get(
      GOOGLE_OAUTH_COOKIE_NAMES.state
    )?.value || '';

  const verifier =
    request.cookies.get(
      GOOGLE_OAUTH_COOKIE_NAMES.verifier
    )?.value || '';

  const nonce =
    request.cookies.get(
      GOOGLE_OAUTH_COOKIE_NAMES.nonce
    )?.value || '';

  if (
    !code ||
    !returnedState ||
    !storedState ||
    returnedState !== storedState ||
    !verifier ||
    !nonce
  ) {
    console.error(
      '[GOOGLE_AUTH_CALLBACK] Invalid OAuth request:',
      {
        hasCode: Boolean(code),
        hasReturnedState: Boolean(returnedState),
        hasStoredState: Boolean(storedState),
        stateMatches:
          Boolean(returnedState) &&
          Boolean(storedState) &&
          returnedState === storedState,
        hasVerifier: Boolean(verifier),
        hasNonce: Boolean(nonce),
      }
    );

    const response = NextResponse.redirect(
      resultUrl(request, 'invalid_request')
    );

    clearGoogleCookies(response);
    return response;
  }

  try {
    const appOrigin = getAppOrigin(request);
    const redirectUri = getGoogleRedirectUri(appOrigin);

    const identity = await exchangeGoogleCodeForIdentity({
      code,
      verifier,
      nonce,
      redirectUri,
    });

    await connectDB();

    let user = await User.findOne({
      googleSubject: identity.subject,
    }).select('+googleSubject');

    if (user && user.email !== identity.email) {
      const emailOwner = await User.findOne({
        email: identity.email,
      })
        .select('_id')
        .lean();

      if (
        emailOwner &&
        String(emailOwner._id) !== String(user._id)
      ) {
        throw new Error(
          'The verified Google email is already linked to another account.'
        );
      }
    }

    if (!user) {
      user = await User.findOne({
        email: identity.email,
      }).select('+googleSubject');
    }

    if (user?.isDeleted) {
      const response = NextResponse.redirect(
        resultUrl(request, 'account_deleted')
      );

      clearGoogleCookies(response);
      return response;
    }

    if (
      user &&
      user.googleSubject &&
      user.googleSubject !== identity.subject
    ) {
      throw new Error(
        'This account is already linked to a different Google identity.'
      );
    }

    if (user) {
      user = await User.findByIdAndUpdate(
        user._id,
        {
          $set: {
            email: identity.email,
            emailVerified: true,
            googleSubject: identity.subject,
            firstName:
              user.firstName || identity.firstName,
            lastName:
              user.lastName || identity.lastName,
          },
          $unset: {
            emailVerificationTokenHash: 1,
            emailVerificationExpires: 1,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        }
      ).select('+googleSubject');
    } else {
      user = await User.create({
        email: identity.email,
        emailVerified: true,
        googleSubject: identity.subject,
        firstName: identity.firstName,
        middleName: '',
        lastName: identity.lastName,
        onboardingCompleted: false,
        patientId: await generateUniquePatientId(),
        monitoredPatients: [],
        authorizedMonitors: [],
      });
    }

    if (!user) {
      throw new Error(
        'Unable to create or link the Google account.'
      );
    }

    const sessionToken = await signToken({
      userId: String(user._id),
      email: String(user.email),
      emailVerified: true,
    });

    const response = NextResponse.redirect(
      resultUrl(
        request,
        'success',
        !user.onboardingCompleted
      )
    );

    response.cookies.set({
      ...COOKIE_OPTIONS,
      value: sessionToken,
    });

    clearGoogleCookies(response);
    return response;
  } catch (error) {
    console.error('[GOOGLE_AUTH_CALLBACK]', error);

    const response = NextResponse.redirect(
      resultUrl(request, 'error')
    );

    clearGoogleCookies(response);
    return response;
  }
}