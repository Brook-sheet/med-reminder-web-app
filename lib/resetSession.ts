// lib/resetSession.ts
import { SignJWT, jwtVerify } from 'jose';

// Deliberately a DIFFERENT key from lib/auth.ts's login-session secret (it's
// derived from the same base secret, but with a distinct suffix, which jose
// treats as a completely different signing key). This is intentional: a
// reset-session token must never be usable as a substitute login/auth
// cookie, even if somehow presented in an Authorization header. Signing it
// with a different key means lib/auth.ts's verifyToken() will simply fail
// to validate it, no matter what claims it contains.
const RESET_SESSION_SECRET = new TextEncoder().encode(
  `${process.env.JWT_SECRET || 'fallback-secret-change-this-in-production-min-32'}:password-reset-session`
);

const RESET_SESSION_TTL = '10m';
const RESET_SESSION_PURPOSE = 'password_reset';

export interface ResetSessionPayload {
  userId: string;
  tokenId: string; // the PasswordResetToken document this session was earned from
  purpose: typeof RESET_SESSION_PURPOSE;
}

/** Issued after a user successfully verifies their 6-digit code. */
export async function signResetSessionToken(userId: string, tokenId: string): Promise<string> {
  return new SignJWT({ userId, tokenId, purpose: RESET_SESSION_PURPOSE })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(RESET_SESSION_TTL)
    .sign(RESET_SESSION_SECRET);
}

/** Returns the payload if valid, or null if missing/expired/tampered/wrong purpose. */
export async function verifyResetSessionToken(token: string): Promise<ResetSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, RESET_SESSION_SECRET);
    if (payload.purpose !== RESET_SESSION_PURPOSE || typeof payload.userId !== 'string' || typeof payload.tokenId !== 'string') {
      return null;
    }
    return { userId: payload.userId, tokenId: payload.tokenId, purpose: RESET_SESSION_PURPOSE };
  } catch {
    return null;
  }
}