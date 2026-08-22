import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import {
  signToken,
  COOKIE_OPTIONS,
} from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

function isDatabaseUnavailableError(
  error: unknown
): boolean {
  if (
    !error ||
    typeof error !== 'object'
  ) {
    return false;
  }

  const code =
    'code' in error
      ? String(
          (error as { code?: unknown }).code
        )
      : '';

  const message =
    'message' in error
      ? String(
          (error as { message?: unknown })
            .message
        )
      : '';

  return (
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'EAI_AGAIN' ||
    code === 'ETIMEDOUT' ||
    message.includes('querySrv') ||
    message.includes(
      'server selection timed out'
    ) ||
    message.includes('MONGODB_URI')
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    await connectDB();

    const body = await request.json();

    const email =
      typeof body.email === 'string'
        ? body.email
            .trim()
            .toLowerCase()
        : '';

    const password =
      typeof body.password === 'string'
        ? body.password
        : '';

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Email and password are required.',
        },
        {
          status: 400,
        }
      );
    }

    const user = await User.findOne({
      email,
    });

    if (!user || !user.password) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Invalid email or password.',
        },
        {
          status: 401,
        }
      );
    }

    if (user.isDeleted) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'This account has been deleted. Please contact support if this is a mistake.',
        },
        {
          status: 403,
        }
      );
    }

    const isPasswordValid =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isPasswordValid) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Invalid email or password.',
        },
        {
          status: 401,
        }
      );
    }

    if (user.emailVerified !== true) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          code: 'EMAIL_NOT_VERIFIED',
          error:
            'Verify your email before signing in.',
          data: {
            email: user.email,
          },
        },
        {
          status: 403,
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

    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
      emailVerified: true,
      role,
    });

    const response =
      NextResponse.json<ApiResponse>({
        success: true,
        message:
          'Signed in successfully.',
        data: {
          user: {
            id: user._id.toString(),
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role,
            patientId: user.patientId,
            onboardingCompleted:
              user.onboardingCompleted,
          },
        },
      });

    response.cookies.set({
      ...COOKIE_OPTIONS,
      value: token,
    });

    return response;
  } catch (error) {
    console.error('[LOGIN]', error);

    if (
      isDatabaseUnavailableError(error)
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'The authentication service is temporarily unavailable. Please try again in a moment.',
        },
        {
          status: 503,
        }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          'Something went wrong. Please try again.',
      },
      {
        status: 500,
      }
    );
  }
}