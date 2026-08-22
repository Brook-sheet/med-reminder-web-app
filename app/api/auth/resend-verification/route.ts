import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import {
  checkAndRecordAttempt,
  checkResendCooldown,
  getClientIp,
} from '@/lib/rateLimit';
import {
  createEmailVerificationToken,
  EMAIL_VERIFICATION_TTL_HOURS,
} from '@/lib/emailVerification';
import { sendEmailVerificationEmail } from '@/lib/email';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

const GENERIC_MESSAGE =
  'If an unverified account exists for this email, a new verification link has been sent.';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    await connectDB();

    const cooldown = await checkResendCooldown(email, 'email-verification');
    if (cooldown.onCooldown) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          code: 'RESEND_COOLDOWN',
          error: `Please wait ${cooldown.retryAfterSeconds} seconds before requesting another email.`,
          data: { retryAfterSeconds: cooldown.retryAfterSeconds },
        },
        {
          status: 429,
          headers: { 'Retry-After': String(cooldown.retryAfterSeconds) },
        }
      );
    }

    const limit = await checkAndRecordAttempt({
      type: 'email-verification',
      email,
      ip: getClientIp(request),
      perEmail: { windowMinutes: 15, max: 3 },
      perIp: { windowMinutes: 15, max: 10 },
    });

    if (limit.limited) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Too many verification requests. Please try again later.',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterMinutes * 60) },
        }
      );
    }

    const user = await User.findOne({
      email,
      emailVerified: { $ne: true },
      isDeleted: { $ne: true },
    });

    if (user) {
      const verification = createEmailVerificationToken();

      await User.updateOne(
        { _id: user._id, emailVerified: { $ne: true } },
        {
          $set: {
            emailVerificationTokenHash: verification.tokenHash,
            emailVerificationExpires: verification.expiresAt,
          },
        }
      );

      await sendEmailVerificationEmail({
        to: user.email,
        firstName: user.firstName,
        token: verification.token,
        expiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
      });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: GENERIC_MESSAGE,
    });
  } catch (error) {
    console.error('[RESEND_VERIFICATION]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Unable to request a verification email. Please try again.' },
      { status: 500 }
    );
  }
}