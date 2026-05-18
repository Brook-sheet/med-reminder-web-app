import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const body = await request.json();
    const { newPassword, confirmPassword } = body;

    // Backend validation
    if (!newPassword || !confirmPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'All fields are required.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Passwords do not match.' },
        { status: 400 }
      );
    }

    // Validate password strength — at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasLetter || !hasNumber) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Password must contain at least one letter and one number.' },
        { status: 400 }
      );
    }

    const existingUser = await User.findById(user.userId);
    if (!existingUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found.' },
        { status: 404 }
      );
    }

    // Prevent using the same password
    const isSamePassword = await bcrypt.compare(newPassword, existingUser.password);
    if (isSamePassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'New password must be different from the current password.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await User.findByIdAndUpdate(user.userId, { password: hashedPassword });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (error) {
    console.error('[PUT /api/profile/update-password]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    );
  }
}