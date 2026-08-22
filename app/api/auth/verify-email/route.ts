import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { hashEmailVerificationToken } from '@/lib/emailVerification';
import {
  COOKIE_OPTIONS,
  signToken,
} from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

export async function POST(
  request: NextRequest
) {
  const body = await request
    .json()
    .catch(() => ({}));

  const token =
    typeof body.token === 'string'
      ? body.token.trim()
      : '';

  if (
    !token ||
    token.length > 256
  ) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        code: 'INVALID_VERIFICATION_LINK',
        error:
          'This verification link is invalid.',
      },
      {
        status: 400,
      }
    );
  }

  try {
    await connectDB();

    const tokenHash =
      hashEmailVerificationToken(token);

    const now = new Date();

    const user =
      await User.findOneAndUpdate(
        {
          emailVerificationTokenHash:
            tokenHash,
          emailVerificationExpires: {
            $gt: now,
          },
          emailVerified: {
            $ne: true,
          },
          isDeleted: {
            $ne: true,
          },
        },
        {
          $set: {
            emailVerified: true,
          },
          $unset: {
            emailVerificationTokenHash: 1,
            emailVerificationExpires: 1,
          },
        },
        {
          new: true,
        }
      );

    if (!user) {
      const expiredTokenExists =
        await User.exists({
          emailVerificationTokenHash:
            tokenHash,
          emailVerificationExpires: {
            $lte: now,
          },
          emailVerified: {
            $ne: true,
          },
        });

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          code: expiredTokenExists
            ? 'VERIFICATION_LINK_EXPIRED'
            : 'INVALID_VERIFICATION_LINK',
          error: expiredTokenExists
            ? 'This verification link has expired. Request a new one below.'
            : 'This verification link is invalid or has already been used.',
        },
        {
          status: expiredTokenExists
            ? 410
            : 400,
        }
      );
    }

    const role =
      user.role === 'family'
        ? 'family'
        : 'patient';

    if (!user.role) {
      user.role = role;
      await user.save();
    }

    const sessionToken =
      await signToken({
        userId: user._id.toString(),
        email: user.email,
        emailVerified: true,
        role,
      });

    const response =
      NextResponse.json<ApiResponse>({
        success: true,
        message:
          'Email verified successfully.',
        data: {
          onboardingRequired:
            role === 'patient' &&
            !user.onboardingCompleted,
          role,
        },
      });

    response.cookies.set({
      ...COOKIE_OPTIONS,
      value: sessionToken,
    });

    return response;
  } catch (error) {
    console.error(
      '[VERIFY_EMAIL]',
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          'Unable to verify your email. Please try again.',
      },
      {
        status: 500,
      }
    );
  }
}