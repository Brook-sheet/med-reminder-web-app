// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import PasswordResetToken, { RESET_CODE_TTL_MINUTES } from '@/models/PasswordResetToken';
import { generateResetCode, hashResetCode } from '@/lib/resetCode';
import { checkAndRecordAttempt, checkResendCooldown, getClientIp, RESEND_COOLDOWN_SECONDS } from '@/lib/rateLimit';
import { sendPasswordResetEmail } from '@/lib/email';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Always the same message, whether or not the email actually belongs to an
// account — this is the core account-enumeration defense for this endpoint.
const GENERIC_SUCCESS_MESSAGE =
  "If an account exists for that email, we've sent a verification code to it.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';

    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase();
    const ip = getClientIp(request);

    await connectDB();

    // 120-second resend cooldown — checked BEFORE the broader rate limit and
    // BEFORE touching the User collection. Reads the same append-only log
    // that's written for every request regardless of whether the email is
    // registered, so a made-up address is throttled identically to a real
    // one and this check can't be used to probe which emails exist.
    const cooldown = await checkResendCooldown(email);
    if (cooldown.onCooldown) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `Please wait ${cooldown.retryAfterSeconds}s before requesting another code.`,
          data: { retryAfterSeconds: cooldown.retryAfterSeconds },
        },
        { status: 429 }
      );
    }

    // Rate limit BEFORE touching the User collection, and key it on the raw
    // submitted email string regardless of whether an account exists for
    // it — this way a flood of requests against a made-up address is
    // throttled identically to a flood against a real one, so the rate
    // limiter itself can't be used to probe which emails are registered.
    const rateLimit = await checkAndRecordAttempt({
      type: 'request',
      email,
      ip,
      perEmail: { windowMinutes: 15, max: 3 },
      perIp: { windowMinutes: 60, max: 10 },
    });

    if (rateLimit.limited) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `Too many requests. Please wait a few minutes before trying again.`,
        },
        { status: 429 }
      );
    }

    const user = await User.findOne({ email, isDeleted: { $ne: true } });

    if (user) {
      // Only one active code at a time — requesting a new one retires any
      // previous unused code for this account.
      await PasswordResetToken.updateMany(
        { userId: user._id, used: false },
        { $set: { used: true, consumedAt: new Date() } }
      );

      const code = generateResetCode();
      const codeHash = hashResetCode(code);
      const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60_000);

      await PasswordResetToken.create({
        userId: user._id,
        email,
        codeHash,
        expiresAt,
        requestIp: ip,
      });

      // Intentionally not awaited-into-the-response-path in a way that would
      // change status/timing based on success — failures are logged, not
      // surfaced, so the response is identical either way (see doc comment
      // on sendPasswordResetEmail).
      await sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        code,
        expiresInMinutes: RESET_CODE_TTL_MINUTES,
      });
    }

    // Include the cooldown duration so the client can start its "Resend
    // code in Ns" countdown from a single source of truth instead of
    // hardcoding 120 on the frontend.
    return NextResponse.json<ApiResponse>({
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
      data: { retryAfterSeconds: RESEND_COOLDOWN_SECONDS },
    });
  } catch (error) {
    console.error('[FORGOT_PASSWORD]', error);
    // Even on an unexpected error, avoid leaking anything account-specific.
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Something went wrong. Please try again in a moment.' },
      { status: 500 }
    );
  }
}