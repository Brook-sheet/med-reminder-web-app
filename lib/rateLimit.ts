// lib/rateLimit.ts
import { NextRequest } from 'next/server';
import PasswordResetAttempt, { PasswordResetAttemptType } from '@/models/PasswordResetAttempt';

/**
 * Best-effort client IP extraction. Next.js's App Router doesn't expose a
 * trustworthy `request.ip` by default, so we read the standard proxy
 * headers a platform like Vercel (or any reverse proxy) sets. Falls back to
 * a constant so rate limiting still degrades gracefully (all "unknown"
 * clients share one bucket) instead of throwing.
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

interface RateLimitRule {
  windowMinutes: number;
  max: number;
}

interface RateLimitCheck {
  type: PasswordResetAttemptType;
  email: string;
  ip: string;
  /** Limit applied per email address within the window. */
  perEmail: RateLimitRule;
  /** Limit applied per IP address within the window (usually looser, since one IP may serve several users). */
  perIp: RateLimitRule;
}

export interface RateLimitResult {
  limited: boolean;
  retryAfterMinutes: number;
}

/**
 * Checks whether a request should be blocked, AND records this attempt.
 * The write happens unconditionally (even for requests we're about to
 * reject) so the log itself can't be bypassed by racing requests, and so
 * that a bad email is rate-limited exactly like a valid one — this is part
 * of what keeps the endpoint from being usable for account enumeration.
 */
export async function checkAndRecordAttempt(params: RateLimitCheck): Promise<RateLimitResult> {
  const { type, email, ip, perEmail, perIp } = params;
  const now = Date.now();

  const emailWindowStart = new Date(now - perEmail.windowMinutes * 60_000);
  const ipWindowStart = new Date(now - perIp.windowMinutes * 60_000);

  const [emailCount, ipCount] = await Promise.all([
    PasswordResetAttempt.countDocuments({ type, email, createdAt: { $gte: emailWindowStart } }),
    PasswordResetAttempt.countDocuments({ type, ip, createdAt: { $gte: ipWindowStart } }),
  ]);

  const limited = emailCount >= perEmail.max || ipCount >= perIp.max;

  // Always log the attempt, whether or not it's allowed — see doc comment.
  await PasswordResetAttempt.create({ type, email, ip });

  return {
    limited,
    retryAfterMinutes: Math.max(perEmail.windowMinutes, perIp.windowMinutes),
  };
}