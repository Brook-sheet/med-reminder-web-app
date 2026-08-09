// app/api/auth/verify-reset-code/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import PasswordResetToken, { MAX_VERIFICATION_ATTEMPTS } from '@/models/PasswordResetToken';
import { verifyResetCode } from '@/lib/resetCode';
import { signResetSessionToken } from '@/lib/resetSession';
import { checkAndRecordAttempt, getClientIp } from '@/lib/rateLimit';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^\d{6}$/;

// One shared message for every failure case (wrong code, expired code, too
// many attempts, unknown email, no active code) so the response never
// reveals which of those actually happened.
const GENERIC_INVALID_MESSAGE = 'That code is invalid or has expired. Please request a new one.';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (!CODE_REGEX.test(code)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Enter the 6-digit code from your email.' }, { status: 400 });
    }

    const email = rawEmail.toLowerCase();
    const ip = getClientIp(request);

    await connectDB();

    const rateLimit = await checkAndRecordAttempt({
      type: 'verify',
      email,
      ip,
      perEmail: { windowMinutes: 15, max: 8 },
      perIp: { windowMinutes: 60, max: 30 },
    });

    if (rateLimit.limited) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Too many attempts. Please wait a few minutes before trying again.' },
        { status: 429 }
      );
    }

    const user = await User.findOne({ email, isDeleted: { $ne: true } });
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: GENERIC_INVALID_MESSAGE }, { status: 400 });
    }

    const token = await PasswordResetToken.findOne({
      userId: user._id,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: GENERIC_INVALID_MESSAGE }, { status: 400 });
    }

    if (token.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      // Retire it outright so it can't keep being probed even at 0 attempts left.
      token.used = true;
      token.consumedAt = new Date();
      await token.save();
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Too many incorrect attempts. Please request a new code.' },
        { status: 400 }
      );
    }

    const isValid = verifyResetCode(code, token.codeHash);
    if (!isValid) {
      token.attempts += 1;
      await token.save();
      return NextResponse.json<ApiResponse>({ success: false, error: GENERIC_INVALID_MESSAGE }, { status: 400 });
    }

    // Correct code — issue a short-lived session so the client can proceed
    // straight to "set new password" without re-entering the code. The code
    // itself is NOT marked used yet; that happens only once the password is
    // actually changed, so the user can safely retry this step if the next
    // one fails partway through.
    const resetToken = await signResetSessionToken(user._id.toString(), token._id.toString());

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Code verified.',
      data: { resetToken },
    });
  } catch (error) {
    console.error('[VERIFY_RESET_CODE]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Something went wrong. Please try again in a moment.' },
      { status: 500 }
    );
  }
}