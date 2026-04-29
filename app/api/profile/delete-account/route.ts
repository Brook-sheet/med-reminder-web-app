import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import Notification from '@/models/Notification';
import FoodLog from '@/models/FoodLog';
import PushSubscription from '@/models/PushSubscription';
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

    // Hard delete — remove all user data permanently
    await Promise.all([
      MedicationLog.deleteMany({ userId: user.userId }),
      Medicine.deleteMany({ userId: user.userId }),
      Notification.deleteMany({ userId: user.userId }),
      FoodLog.deleteMany({ userId: user.userId }),
      PushSubscription.deleteMany({ userId: user.userId }),
    ]);

    // Finally delete the user account itself
    const deletedUser = await User.findByIdAndDelete(user.userId);

    if (!deletedUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Clear auth cookie
    const response = NextResponse.json<ApiResponse>({
      success: true,
      message: 'Account and all associated data permanently deleted.',
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