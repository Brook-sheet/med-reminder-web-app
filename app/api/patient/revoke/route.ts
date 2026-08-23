import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import MonitoringRequest from '@/models/MonitoringRequest';
import Notification from '@/models/Notification';
import User from '@/models/User';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  return token ? verifyToken(token) : null;
}

// Compatibility endpoint for older clients.
// New UI uses PATCH /api/patient/monitor with action: "revoke".
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const requestId =
      request.nextUrl.searchParams.get('requestId') ?? '';

    const familyId = (
      request.nextUrl.searchParams.get('familyId') ?? ''
    )
      .trim()
      .toUpperCase();

    if (!requestId && !familyId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'A monitoring request ID or Family ID is required.',
        },
        { status: 400 }
      );
    }

    if (
      requestId &&
      !mongoose.Types.ObjectId.isValid(requestId)
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Invalid monitoring request ID.',
        },
        { status: 400 }
      );
    }

    await connectDB();

    const patient = await User.findById(auth.userId).select(
      '_id role firstName lastName isDeleted'
    );

    if (!patient || patient.isDeleted) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (patient.role !== 'patient') {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Only the Patient can revoke monitoring access.',
        },
        { status: 403 }
      );
    }

    let familyObjectId:
      | mongoose.Types.ObjectId
      | undefined;

    if (familyId) {
      const family = await User.findOne({
        familyId,
        role: 'family',
        isDeleted: { $ne: true },
      }).select('_id');

      if (!family) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: 'Family account not found.',
          },
          { status: 404 }
        );
      }

      familyObjectId = family._id;
    }

    const monitoring = await MonitoringRequest.findOne({
      ...(requestId
        ? { _id: requestId }
        : { familyId: familyObjectId }),
      patientId: patient._id,
      status: 'approved',
    });

    if (!monitoring) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Approved monitoring access was not found.',
        },
        { status: 404 }
      );
    }

    monitoring.status = 'revoked';
    monitoring.respondedAt = new Date();
    await monitoring.save();

    const patientName =
      `${patient.firstName ?? ''} ${
        patient.lastName ?? ''
      }`.trim() || 'The Patient';

    await Notification.create({
      userId: monitoring.familyId,
      type: 'monitoring_revoked',
      title: 'Monitoring Access Revoked',
      message: `${patientName} revoked your monitoring access.`,
      monitoringRequestId: monitoring._id,
      read: false,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Monitoring access revoked.',
      data: {
        requestId: monitoring._id.toString(),
        status: monitoring.status,
      },
    });
  } catch (error) {
    console.error('[DELETE /api/patient/revoke]', error);

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}