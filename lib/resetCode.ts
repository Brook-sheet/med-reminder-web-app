// lib/resetCode.ts
import crypto from 'crypto';

// A dedicated secret for hashing reset codes. Falls back to deriving from
// JWT_SECRET so the feature works out of the box without a new required env
// var, but a real deployment should set RESET_CODE_SECRET explicitly.
const RESET_CODE_SECRET =
  process.env.RESET_CODE_SECRET ||
  `${process.env.JWT_SECRET || 'fallback-secret-change-this-in-production-min-32'}:reset-code`;

/** Generates a cryptographically random 6-digit numeric code, e.g. "042917". */
export function generateResetCode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

/**
 * HMAC-SHA256 the code with a server-side secret before storing it. Using an
 * HMAC (not a bare SHA-256 hash) means that even if the PasswordResetToken
 * collection were somehow read directly, an attacker without the secret
 * still can't brute-force which of the 1,000,000 possible codes a given
 * hash corresponds to.
 */
export function hashResetCode(code: string): string {
  return crypto.createHmac('sha256', RESET_CODE_SECRET).update(code).digest('hex');
}

/** Constant-time comparison so verification isn't vulnerable to a timing attack. */
export function verifyResetCode(code: string, hash: string): boolean {
  const candidate = Buffer.from(hashResetCode(code), 'hex');
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}