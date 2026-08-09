// app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import PasswordResetToken from '@/models/PasswordResetToken';
import { verifyResetSessionToken } from '@/lib/resetSession';
import { validatePasswordStrength } from '@/lib/passwordPolicy';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const resetToken = typeof body.resetToken === 'string' ? body.resetToken : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

    if (!resetToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Your session has expired. Please verify your code again.' },
        { status: 400 }
      );
    }

    if (!newPassword || !confirmPassword) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'All fields are required.' }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Passwords do not match.' }, { status: 400 });
    }
    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return NextResponse.json<ApiResponse>({ success: false, error: strengthError }, { status: 400 });
    }

    const session = await verifyResetSessionToken(resetToken);
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Your session has expired. Please verify your code again.' },
        { status: 400 }
      );
    }

    await connectDB();

    // Defense in depth: re-check the underlying code record even though the
    // session JWT is itself time-limited — this covers the case where the
    // 15-minute code TTL elapses partway through an otherwise-still-valid
    // 10-minute session, and guarantees a code can never be consumed twice.
    const token = await PasswordResetToken.findOne({
      _id: session.tokenId,
      userId: session.userId,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'This reset link has expired or was already used. Please request a new code.' },
        { status: 400 }
      );
    }

    const user = await User.findById(session.userId);
    if (!user || user.isDeleted) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Account not found.' }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    // Invalidate this code and any other still-active codes for the account
    // now that the password has actually changed.
    await PasswordResetToken.updateMany(
      { userId: user._id, used: false },
      { $set: { used: true, consumedAt: new Date() } }
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Your password has been reset. You can now sign in with your new password.',
    });
  } catch (error) {
    console.error('[RESET_PASSWORD]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Something went wrong. Please try again in a moment.' },
      { status: 500 }
    );
  }
}