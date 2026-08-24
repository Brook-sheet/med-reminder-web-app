import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import Notification from '@/models/Notification';
import SensorData from '@/models/SensorData';
import Alert from '@/models/Alert';
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

    // Permanently delete all user data except profile information
    await Promise.all([
      Medicine.deleteMany({ userId: user.userId }),
      MedicationLog.deleteMany({ userId: user.userId }),
      Notification.deleteMany({ userId: user.userId }),
      SensorData.deleteMany({ userId: user.userId }),
      Alert.deleteMany({
        $or: [
          { patientId: user.userId },
          { monitorId: user.userId },
        ],
      }),
    ]);

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