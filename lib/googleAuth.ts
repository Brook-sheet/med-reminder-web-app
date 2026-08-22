import {
  createHash,
  randomBytes,
} from "crypto";
import {
  createRemoteJWKSet,
  jwtVerify,
} from "jose";

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";

const GOOGLE_TOKEN_ENDPOINT =
  "https://oauth2.googleapis.com/token";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/oauth2/v3/certs"
  )
);

export const GOOGLE_OAUTH_COOKIE_NAMES = {
  state: "med_google_oauth_state",
  verifier: "med_google_oauth_verifier",
  nonce: "med_google_oauth_nonce",
} as const;

export const GOOGLE_OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 10 * 60,
  path: "/api/auth/google",
};

export interface GoogleIdentity {
  subject: string;
  email: string;
  firstName: string;
  lastName: string;
}

function requireEnvironmentVariable(
  name:
    | "GOOGLE_CLIENT_ID"
    | "GOOGLE_CLIENT_SECRET"
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured.`
    );
  }

  return value;
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function getGoogleRedirectUri(
  requestOrigin: string
): string {
  const configuredUri =
    process.env.GOOGLE_REDIRECT_URI?.trim();

  if (configuredUri) {
    return configuredUri;
  }

  const configuredAppUrl =
    process.env.NEXT_PUBLIC_APP_URL
      ?.trim()
      .replace(/\/+$/, "");

  return `${
    configuredAppUrl || requestOrigin
  }/api/auth/google/callback`;
}

export function createGoogleAuthorizationRequest(
  redirectUri: string
) {
  const clientId =
    requireEnvironmentVariable(
      "GOOGLE_CLIENT_ID"
    );

  const state = randomBytes(32).toString(
    "base64url"
  );

  const verifier =
    randomBytes(64).toString("base64url");

  const nonce = randomBytes(32).toString(
    "base64url"
  );

  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");

  const url = new URL(
    GOOGLE_AUTHORIZATION_ENDPOINT
  );

  url.searchParams.set(
    "client_id",
    clientId
  );

  url.searchParams.set(
    "redirect_uri",
    redirectUri
  );

  url.searchParams.set(
    "response_type",
    "code"
  );

  url.searchParams.set(
    "scope",
    "openid email profile"
  );

  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);

  url.searchParams.set(
    "code_challenge",
    challenge
  );

  url.searchParams.set(
    "code_challenge_method",
    "S256"
  );

  url.searchParams.set(
    "prompt",
    "select_account"
  );

  return {
    url,
    state,
    verifier,
    nonce,
  };
}

export async function exchangeGoogleCodeForIdentity(
  params: {
    code: string;
    verifier: string;
    nonce: string;
    redirectUri: string;
  }
): Promise<GoogleIdentity> {
  const clientId =
    requireEnvironmentVariable(
      "GOOGLE_CLIENT_ID"
    );

  const clientSecret =
    requireEnvironmentVariable(
      "GOOGLE_CLIENT_SECRET"
    );

  const tokenResponse = await fetch(
    GOOGLE_TOKEN_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: params.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: params.redirectUri,
        grant_type: "authorization_code",
        code_verifier: params.verifier,
      }),
      cache: "no-store",
    }
  );

  const tokenPayload =
    (await tokenResponse
      .json()
      .catch(() => ({}))) as {
      id_token?: string;
      error?: string;
      error_description?: string;
    };

  if (
    !tokenResponse.ok ||
    !tokenPayload.id_token
  ) {
    console.error(
      "[GOOGLE_AUTH] Token exchange failed:",
      {
        status: tokenResponse.status,
        error: tokenPayload.error,
        description:
          tokenPayload.error_description,
      }
    );

    throw new Error(
      "Google token exchange failed."
    );
  }

  const { payload } = await jwtVerify(
    tokenPayload.id_token,
    GOOGLE_JWKS,
    {
      audience: clientId,
      issuer: [
        "https://accounts.google.com",
        "accounts.google.com",
      ],
    }
  );

  if (payload.nonce !== params.nonce) {
    throw new Error(
      "Google authentication nonce did not match."
    );
  }

  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true
  ) {
    throw new Error(
      "Google did not provide a verified email identity."
    );
  }

  const fullName =
    typeof payload.name === "string"
      ? payload.name.trim()
      : "";

  const nameParts = fullName
    .split(/\s+/)
    .filter(Boolean);

  const firstName =
    typeof payload.given_name === "string"
      ? payload.given_name.trim()
      : nameParts[0] || "Google";

  const lastName =
    typeof payload.family_name === "string"
      ? payload.family_name.trim()
      : nameParts.slice(1).join(" ") ||
        "User";

  return {
    subject: payload.sub,
    email: payload.email
      .trim()
      .toLowerCase(),
    firstName,
    lastName,
  };
}