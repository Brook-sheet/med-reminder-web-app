import mongoose from 'mongoose';
import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Alert from '@/models/Alert';
import MedicationLog from '@/models/MedicationLog';
import {
  getTokenFromRequest,
  verifyToken,
} from '@/lib/auth';
import { serializeAlert } from '@/lib/alertSerializer';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import { getApprovedPatientIdsForMonitor } from '@/lib/monitoringAuthorization';

export const dynamic = 'force-dynamic';

async function authorizeFamily(
  request: NextRequest,
) {
  const token =
    getTokenFromRequest(request);

  const auth =
    token
      ? await verifyToken(token)
      : null;

  return auth?.role === 'family'
    ? auth
    : null;
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      alertId: string;
    }>;
  },
) {
  try {
    const auth =
      await authorizeFamily(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Access denied.',
        },
        {
          status: 403,
        },
      );
    }

    const { alertId } =
      await params;

    if (
      !mongoose.isValidObjectId(
        alertId,
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Invalid alert ID.',
        },
        {
          status: 400,
        },
      );
    }

    await connectDB();

    const patientIds =
      await getApprovedPatientIdsForMonitor(
        auth.userId,
      );

    const alert =
      await Alert.findOne({
        _id:
          alertId,

        monitorId:
          auth.userId,

        patientId: {
          $in:
            patientIds,
        },
      })
        .populate(
          'patientId',
          'firstName lastName patientId',
        )
        .populate(
          'medicationId',
          'name dosage',
        )
        .populate({
          path:
            'medicationLogId',

          model:
            MedicationLog,

          select:
            'annotations',
        })
        .lean();

    if (!alert) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Alert not found.',
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json<ApiResponse>({
      success:
        true,

      data:
        serializeAlert(alert),
    });
  } catch (error) {
    console.error(
      '[GET /api/alerts/[alertId]]',
      error,
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          'Internal server error',
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      alertId: string;
    }>;
  },
) {
  try {
    const auth =
      await authorizeFamily(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Access denied.',
        },
        {
          status: 403,
        },
      );
    }

    const { alertId } =
      await params;

    if (
      !mongoose.isValidObjectId(
        alertId,
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Invalid alert ID.',
        },
        {
          status: 400,
        },
      );
    }

    const body =
      (await request.json()) as {
        action?:
          | 'read'
          | 'acknowledge';
      };

    if (
      !body.action ||
      ![
        'read',
        'acknowledge',
      ].includes(body.action)
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'action must be read or acknowledge.',
        },
        {
          status: 400,
        },
      );
    }

    await connectDB();

    const patientIds =
      await getApprovedPatientIdsForMonitor(
        auth.userId,
      );

    const now =
      new Date();

    /*
     * Alert acknowledgment affects only the alert's
     * read/acknowledged state. It does not change the
     * patient's medication status.
     */
    const update =
      body.action === 'acknowledge'
        ? {
            status:
              'ACKNOWLEDGED',

            isRead:
              true,

            readAt:
              now,

            acknowledgedAt:
              now,
          }
        : {
            status:
              'READ',

            isRead:
              true,

            readAt:
              now,
          };

    const alert =
      await Alert.findOneAndUpdate(
        {
          _id:
            alertId,

          monitorId:
            auth.userId,

          patientId: {
            $in:
              patientIds,
          },
        },
        {
          $set:
            update,
        },
        {
          new:
            true,
        },
      )
        .populate(
          'patientId',
          'firstName lastName patientId',
        )
        .populate(
          'medicationId',
          'name dosage',
        )
        .populate({
          path:
            'medicationLogId',

          model:
            MedicationLog,

          select:
            'annotations',
        })
        .lean();

    if (!alert) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Alert not found.',
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json<ApiResponse>({
      success:
        true,

      data:
        serializeAlert(alert),
    });
  } catch (error) {
    console.error(
      '[PATCH /api/alerts/[alertId]]',
      error,
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          'Internal server error',
      },
      {
        status: 500,
      },
    );
  }
}