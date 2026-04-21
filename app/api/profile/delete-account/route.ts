import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getTokenFromRequest, verifyToken, COOKIE_OPTIONS } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    // Soft delete — mark as deleted, keep record in DB
    const updatedUser = await User.findByIdAndUpdate(
      user.userId,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!updatedUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Clear auth cookie to log the user out
    const response = NextResponse.json<ApiResponse>({
      success: true,
      message: 'Account deleted successfully',
    });

    response.cookies.set({ ...COOKIE_OPTIONS, value: '', maxAge: 0 });
    return response;
  } catch (error) {
    console.error('[DELETE /api/profile/delete-account]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}