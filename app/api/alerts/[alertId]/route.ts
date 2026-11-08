import mongoose from 'mongoose';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  getTokenFromRequest,
  verifyToken,
} from '@/lib/auth';

import type {
  ApiResponse,
} from '@/lib/interfaces/data/Api';

import { connectDB } from '@/lib/mongodb';

import {
  getApprovedPatientIdsForMonitor,
} from '@/lib/monitoringAuthorization';

import {
  serializeAlert,
} from '@/lib/alertSerializer';

import Alert from '@/models/Alert';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

type Context = {
  params: Promise<{
    alertId: string;
  }>;
};

const population = [
  {
    path: 'patientId',
    model: User,
    select:
      'firstName lastName patientId',
  },
  {
    path: 'medicationId',
    model: Medicine,
    select: 'name dosage',
  },
  {
    path: 'medicationLogId',
    model: MedicationLog,
    select: 'annotations',
  },
];

function failure(
  error: string,
  status: number,
) {
  return NextResponse.json<ApiResponse>(
    {
      success: false,
      error,
    },
    { status },
  );
}

async function authorize(
  request: NextRequest,
) {
  const token =
    getTokenFromRequest(request);

  const auth = token
    ? await verifyToken(token)
    : null;

  return auth?.role === 'family'
    ? auth
    : null;
}

export async function GET(
  request: NextRequest,
  context: Context,
) {
  try {
    const auth =
      await authorize(request);

    if (!auth) {
      return failure(
        'Access denied.',
        403,
      );
    }

    const { alertId } =
      await context.params;

    if (
      !mongoose.isValidObjectId(
        alertId,
      )
    ) {
      return failure(
        'Invalid alert ID.',
        400,
      );
    }

    await connectDB();

    const patientIds =
      await getApprovedPatientIdsForMonitor(
        auth.userId,
      );

    const alert =
      await Alert.findOne({
        _id: alertId,
        monitorId: auth.userId,

        patientId: {
          $in: patientIds,
        },
      })
        .populate(population)
        .lean();

    if (!alert) {
      return failure(
        'Alert not found.',
        404,
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: serializeAlert(alert),
    });
  } catch (error) {
    console.error(
      '[GET /api/alerts/[alertId]]',
      error,
    );

    return failure(
      'Internal server error',
      500,
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: Context,
) {
  try {
    const auth =
      await authorize(request);

    if (!auth) {
      return failure(
        'Access denied.',
        403,
      );
    }

    const { alertId } =
      await context.params;

    if (
      !mongoose.isValidObjectId(
        alertId,
      )
    ) {
      return failure(
        'Invalid alert ID.',
        400,
      );
    }

    const body =
      await request
        .json()
        .catch(() => ({}));

    if (
      ![
        'read',
        'acknowledge',
        'claimPopup',
      ].includes(body.action)
    ) {
      return failure(
        'action must be read, acknowledge, or claimPopup.',
        400,
      );
    }

    await connectDB();

    const patientIds =
      await getApprovedPatientIdsForMonitor(
        auth.userId,
      );

    const filter = {
      _id: alertId,
      monitorId: auth.userId,

      patientId: {
        $in: patientIds,
      },
    };

    const now = new Date();

    if (
      body.action === 'claimPopup'
    ) {
      /*
       * One atomic update chooses one winner across
       * sessions, tabs, devices, and repeated events.
       *
       * Popup display never changes isRead.
       */
      const alert =
        await Alert.findOneAndUpdate(
          {
            ...filter,
            popupShown: false,
            isRead: false,
            status: 'UNREAD',

            'channels.inApp': {
              $ne: false,
            },
          },
          {
            $set: {
              popupShown: true,
              popupShownAt: now,
            },
          },
          { new: true },
        )
          .populate(population)
          .lean();

      return NextResponse.json<ApiResponse>({
        success: true,

        data: {
          claimed: Boolean(alert),

          alert:
            alert
              ? serializeAlert(alert)
              : null,
        },
      });
    }

    /*
     * Reading and acknowledging keep their existing
     * behavior. They do not modify medication logs
     * or send another SMS.
     */
    const update =
      body.action === 'acknowledge'
        ? {
            status: 'ACKNOWLEDGED',
            isRead: true,
            readAt: now,
            acknowledgedAt: now,
          }
        : {
            status: 'READ',
            isRead: true,
            readAt: now,
          };

    const alert =
      await Alert.findOneAndUpdate(
        filter,
        { $set: update },
        { new: true },
      )
        .populate(population)
        .lean();

    if (!alert) {
      return failure(
        'Alert not found.',
        404,
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: serializeAlert(alert),
    });
  } catch (error) {
    console.error(
      '[PATCH /api/alerts/[alertId]]',
      error,
    );

    return failure(
      'Internal server error',
      500,
    );
  }
}