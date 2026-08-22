import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { validateEmail } from '@/lib/emailValidation';
import { generateUniquePatientId } from '@/lib/generatePatientId';
import {
  createEmailVerificationToken,
  EMAIL_VERIFICATION_TTL_HOURS,
} from '@/lib/emailVerification';
import { sendEmailVerificationEmail } from '@/lib/email';
import { checkAndRecordAttempt, getClientIp } from '@/lib/rateLimit';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { email, password, confirmPassword, firstName, middleName, lastName } = body;

    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Please fill in all required fields.' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailCheck = await validateEmail(normalizedEmail);
    if (!emailCheck.valid) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: emailCheck.error || 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Passwords do not match.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Password must contain at least one letter and one number.' },
        { status: 400 }
      );
    }

    const limit = await checkAndRecordAttempt({
      type: 'email-verification',
      email: normalizedEmail,
      ip: getClientIp(request),
      perEmail: { windowMinutes: 15, max: 3 },
      perIp: { windowMinutes: 15, max: 10 },
    });

    if (limit.limited) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Too many registration attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterMinutes * 60) },
        }
      );
    }

    const existingUser = await User.findOne({ email: normalizedEmail })
      .select('+googleSubject')
      .lean();

    if (existingUser) {
      if (!existingUser.emailVerified && !existingUser.isDeleted) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            code: 'EMAIL_NOT_VERIFIED',
            error: 'An account with this email is waiting for verification.',
            data: { email: normalizedEmail },
          },
          { status: 409 }
        );
      }

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: existingUser.googleSubject
            ? 'This email is already connected to Google. Continue with Google to sign in.'
            : 'An account with this email already exists.',
        },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const patientId = await generateUniquePatientId();
    const verification = createEmailVerificationToken();

    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      firstName: String(firstName).trim(),
      middleName: String(middleName || '').trim(),
      lastName: String(lastName).trim(),
      emailVerified: false,
      emailVerificationTokenHash: verification.tokenHash,
      emailVerificationExpires: verification.expiresAt,
      onboardingCompleted: false,
      patientId,
      monitoredPatients: [],
      authorizedMonitors: [],
    });

    const emailSent = await sendEmailVerificationEmail({
      to: user.email,
      firstName: user.firstName,
      token: verification.token,
      expiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
    });

    if (!emailSent) {
      await User.deleteOne({ _id: user._id, emailVerified: false });
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Unable to send the verification email. Please try again in a moment.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: 'Account created. Check your inbox to verify your email.',
        data: { email: user.email },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      Number((error as { code?: unknown }).code) === 11000
    ) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    if (error instanceof Error) {
      console.error('[REGISTER] ERROR:', error.message);
      console.error('[REGISTER] STACK:', error.stack);
    } else {
      console.error('[REGISTER] UNKNOWN ERROR:', error);
    }

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Unable to create your account. Please try again.' },
      { status: 500 }
    );
  }
}