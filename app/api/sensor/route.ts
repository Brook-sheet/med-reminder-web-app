import {
  NextRequest,
  NextResponse,
} from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import SensorData, {
  type ISensorDataDocument,
} from '@/models/SensorData';
import { processMedicationEvent } from '@/lib/medicationVerification';
import type { ApiResponse } from '@/types';

const SENSOR_API_KEY =
  process.env.SENSOR_API_KEY ||
  'dev-sensor-key-change-me';

function authorized(
  request: NextRequest
): boolean {
  const key =
    request.headers.get(
      'x-sensor-key'
    ) ||
    request.headers.get(
      'x-api-key'
    );

  return (
    process.env.NODE_ENV !==
      'production' ||
    key === SENSOR_API_KEY
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    if (!authorized(request)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Unauthorized sensor',
        },
        {
          status: 401,
        }
      );
    }

    await connectDB();

    const body =
      (await request.json()) as Record<
        string,
        unknown
      >;

    const deviceId =
      typeof body.deviceId === 'string'
        ? body.deviceId
        : '';

    const event =
      typeof body.event === 'string'
        ? body.event
        : '';

    const userId =
      typeof body.userId === 'string'
        ? body.userId
        : '';

    const timestamp =
      typeof body.timestamp === 'string'
        ? new Date(body.timestamp)
        : new Date();

    if (!deviceId || !event) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'deviceId and event are required.',
        },
        {
          status: 400,
        }
      );
    }

    const supportedEvents:
      ISensorDataDocument['event'][] = [
        'pill_taken',
        'pill_dispensed',
        'container_opened',
        'heartbeat',
      ];

    if (
      !supportedEvents.includes(
        event as ISensorDataDocument['event']
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'event must be pill_taken, pill_dispensed, container_opened, or heartbeat.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      userId &&
      !mongoose.isValidObjectId(userId)
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'userId must be a valid MongoDB ObjectId.',
        },
        {
          status: 400,
        }
      );
    }

    const sensorEvent =
      event as ISensorDataDocument['event'];

    const sensorUserId = userId
      ? new mongoose.mongo.ObjectId(
          userId
        )
      : null;

    const sensorRecord =
      await SensorData.create({
        deviceId,
        event: sensorEvent,
        userId: sensorUserId,
        timestamp,
        rawData:
          body.rawData || body,
        processed: false,
      });

    const sensorRecordId =
      sensorRecord._id.toString();

    if (sensorEvent === 'heartbeat') {
      return NextResponse.json<ApiResponse>({
        success: true,
        message:
          'Heartbeat received.',
        data: {
          sensorId: sensorRecordId,
        },
      });
    }

    if (!userId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'userId is required for medication events.',
        },
        {
          status: 400,
        }
      );
    }

    const chamberId =
      body.chamberId == null
        ? null
        : Number(body.chamberId);

    const result =
      await processMedicationEvent({
        userId,
        source: 'sensor',
        eventType:
          sensorEvent ===
          'pill_dispensed'
            ? 'MISSED'
            : 'CHAMBER_OPENED',
        timestamp,
        chamberId,
        medicineId:
          typeof body.medicineId ===
          'string'
            ? body.medicineId
            : null,
        deviceId,
      });

    await SensorData.findByIdAndUpdate(
      sensorRecordId,
      {
        processed: result.verified,
        medicineName:
          result.medicineName,
      }
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Internal server error';

    console.error(
      '[POST /api/sensor]',
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: message,
      },
      {
        status: 400,
      }
    );
  }
}

export async function GET(
  request: NextRequest
) {
  if (!authorized(request)) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          'Unauthorized sensor',
      },
      {
        status: 401,
      }
    );
  }

  return NextResponse.json<ApiResponse>({
    success: true,
    message:
      'Sensor API is online.',
    data: {
      timestamp: new Date(),
    },
  });
}