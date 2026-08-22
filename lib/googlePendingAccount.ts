import { SignJWT, jwtVerify } from "jose";
import type { GoogleIdentity } from "@/lib/googleAuth";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ||
    "fallback-secret-change-this-in-production-min-32"
);

export const GOOGLE_PENDING_ACCOUNT_COOKIE =
  "med_google_pending_account";

export const GOOGLE_PENDING_ACCOUNT_COOKIE_OPTIONS = {
  name: GOOGLE_PENDING_ACCOUNT_COOKIE,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 10 * 60,
  path: "/api/auth/google",
};

interface PendingGoogleAccount extends GoogleIdentity {
  purpose: "google-account-role-selection";
}

export async function createPendingGoogleAccountToken(
  identity: GoogleIdentity
): Promise<string> {
  return new SignJWT({
    ...identity,
    purpose: "google-account-role-selection",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(SECRET);
}

export async function verifyPendingGoogleAccountToken(
  token: string
): Promise<PendingGoogleAccount | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      SECRET
    );

    if (
      payload.purpose !==
        "google-account-role-selection" ||
      typeof payload.subject !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.firstName !== "string" ||
      typeof payload.lastName !== "string"
    ) {
      return null;
    }

    return {
      purpose:
        "google-account-role-selection",
      subject: payload.subject,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
    };
  } catch {
    return null;
  }
}