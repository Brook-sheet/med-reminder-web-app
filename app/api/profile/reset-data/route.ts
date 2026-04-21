import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Medicine from '@/models/Medicine';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const resetTimestamp = new Date();

    // Soft delete all medicines by setting isActive to false
    await Medicine.updateMany(
      { userId: user.userId },
      { isActive: false }
    );

    // Save the reset timestamp on the user record.
    // The history and dashboard APIs filter out logs created before this date.
    await User.findByIdAndUpdate(user.userId, {
      dataResetAt: resetTimestamp,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'All data has been reset successfully.',
    });
  } catch (error) {
    console.error('[POST /api/profile/reset-data]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}