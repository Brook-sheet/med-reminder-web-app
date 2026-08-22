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

/** How long a user must wait between successive "send me a code" requests. */
export const RESEND_COOLDOWN_SECONDS = 120;

export interface CooldownResult {
  onCooldown: boolean;
  /** Seconds remaining until another code can be requested (0 if not on cooldown). */
  retryAfterSeconds: number;
}

/**
 * Enforces the 120-second resend cooldown for password-reset or email-verification requests.
 *
 * This reads from the SAME append-only PasswordResetAttempt log that
 * checkAndRecordAttempt() writes to, so it applies
 * identically whether the email belongs to a real account or not — keeping
 * the endpoint safe from account enumeration via response-timing/shape
 * differences. It's a dedicated, tighter check layered underneath the
 * broader 15-minute/3-request window: this one specifically produces the
 * "Resend code in Ns" countdown the UI needs, and closes the gap where a
 * user (or a script) could otherwise hammer the endpoint as fast as the
 * 15-minute window allows.
 *
 * Read-only — does not itself write a log row. The caller still goes on to
 * call checkAndRecordAttempt() (which does write one) when not on cooldown,
 * so the timestamp used here is always up to date for the next check.
 */
export async function checkResendCooldown(
  email: string,
  type: PasswordResetAttemptType = 'request'
): Promise<CooldownResult> {
  const lastAttempt = await PasswordResetAttempt.findOne({ type, email })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean();

  if (!lastAttempt) {
    return { onCooldown: false, retryAfterSeconds: 0 };
  }

  const elapsedMs = Date.now() - new Date(lastAttempt.createdAt).getTime();
  const remainingMs = RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs;

  if (remainingMs <= 0) {
    return { onCooldown: false, retryAfterSeconds: 0 };
  }

  return { onCooldown: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}