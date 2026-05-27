import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// DELETE: patient revokes a monitor's access
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const monitorPatientId = searchParams.get('monitorPatientId');

    if (!monitorPatientId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Monitor Patient ID is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const currentUser = await User.findById(auth.userId).select(
      'patientId authorizedMonitors'
    );
    if (!currentUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Remove monitor from patient's authorized list
    await User.findByIdAndUpdate(auth.userId, {
      $pull: { authorizedMonitors: monitorPatientId },
    });

    // Remove patient from monitor's list
    const monitorUser = await User.findOne({ patientId: monitorPatientId }).select('_id');
    if (monitorUser) {
      await User.findByIdAndUpdate(monitorUser._id, {
        $pull: { monitoredPatients: currentUser.patientId },
      });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { revoked: monitorPatientId },
    });
  } catch (error) {
    console.error('[DELETE /api/patient/revoke]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}