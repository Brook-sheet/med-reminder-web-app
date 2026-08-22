import { createHash, randomBytes } from 'crypto';

export const EMAIL_VERIFICATION_TTL_HOURS = 24;

export interface EmailVerificationToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export function hashEmailVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createEmailVerificationToken(): EmailVerificationToken {
  const token = randomBytes(32).toString('base64url');

  return {
    token,
    tokenHash: hashEmailVerificationToken(token),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000),
  };
}