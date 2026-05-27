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

// GET: list all patients this user is monitoring
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
    const user = await User.findById(auth.userId).select('monitoredPatients');
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch details of all monitored patients
    const patients = await User.find({
      patientId: { $in: user.monitoredPatients },
    }).select('patientId firstName lastName condition');

    return NextResponse.json<ApiResponse>({
      success: true,
      data: patients.map((p) => ({
        patientId: p.patientId,
        name: `${p.firstName} ${p.lastName}`,
        condition: p.condition,
      })),
    });
  } catch (error) {
    console.error('[GET /api/patient/monitor]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: link a patient by Patient ID
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { patientId } = body;

    if (!patientId || typeof patientId !== 'string') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    const normalizedId = patientId.trim().toUpperCase();

    await connectDB();

    const currentUser = await User.findById(auth.userId).select(
      'patientId monitoredPatients'
    );
    if (!currentUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent self-monitoring
    if (currentUser.patientId === normalizedId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'You cannot monitor your own account' },
        { status: 400 }
      );
    }

    // Prevent duplicate
    if (currentUser.monitoredPatients.includes(normalizedId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'You are already monitoring this patient' },
        { status: 400 }
      );
    }

    // Validate target patient exists
    const targetPatient = await User.findOne({ patientId: normalizedId }).select(
      'patientId firstName lastName condition authorizedMonitors'
    );
    if (!targetPatient) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No patient found with this ID' },
        { status: 404 }
      );
    }

    // Link: add to monitor's list + patient's authorized monitors
    await User.findByIdAndUpdate(auth.userId, {
      $addToSet: { monitoredPatients: normalizedId },
    });

    await User.findByIdAndUpdate(targetPatient._id, {
      $addToSet: { authorizedMonitors: currentUser.patientId },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        patientId: targetPatient.patientId,
        name: `${targetPatient.firstName} ${targetPatient.lastName}`,
        condition: targetPatient.condition,
      },
    });
  } catch (error) {
    console.error('[POST /api/patient/monitor]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: unlink a monitored patient
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
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const currentUser = await User.findById(auth.userId).select(
      'patientId monitoredPatients'
    );
    if (!currentUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Remove from monitor's list
    await User.findByIdAndUpdate(auth.userId, {
      $pull: { monitoredPatients: patientId },
    });

    // Remove from patient's authorized monitors
    const targetPatient = await User.findOne({ patientId }).select('_id');
    if (targetPatient) {
      await User.findByIdAndUpdate(targetPatient._id, {
        $pull: { authorizedMonitors: currentUser.patientId },
      });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { removed: patientId },
    });
  } catch (error) {
    console.error('[DELETE /api/patient/monitor]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}