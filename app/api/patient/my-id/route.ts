import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { generateUniquePatientId } from '@/lib/generatePatientId';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const user = await User.findById(auth.userId).select(
      'role patientId firstName lastName isDeleted'
    );

    if (!user || user.isDeleted) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.role !== 'patient') {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Patient IDs are available only to Patient accounts.',
        },
        { status: 403 }
      );
    }

    // Backfill patientId for existing users.
    if (!user.patientId) {
      const patientId = await generateUniquePatientId();
      user.patientId = patientId;
      await user.save();
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        patientId: user.patientId,
        name: `${user.firstName} ${user.lastName}`,
      },
    });
  } catch (error) {
    console.error('[GET /api/patient/my-id]', error);

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}