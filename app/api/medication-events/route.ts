// app/api/medication-events/route.ts
import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  connectDB,
} from '@/lib/mongodb';

import {
  getTokenFromRequest,
  verifyToken,
} from '@/lib/auth';

import {
  processMedicationEvent,
  type MedicationEventSource,
  type MedicationEventType,
} from '@/lib/medicationVerification';

const SENSOR_API_KEY =
  process.env
    .SENSOR_API_KEY
    ?.trim() ??
  '';

const EVENT_TYPES:
  MedicationEventType[] = [
    'CHAMBER_OPENED',
    'MEDICATION_DISPENSED',
    'MEDICATION_CONFIRMED',
    'MISSED',
  ];

function sensorAuthorized(
  request: NextRequest
): boolean {
  const key =
    request.headers.get(
      'x-sensor-key'
    ) ||
    request.headers.get(
      'x-api-key'
    );

  /*
   * Fail closed in every environment.
   * There is no development fallback sensor key.
   */
  return Boolean(
    SENSOR_API_KEY &&
    key &&
    key === SENSOR_API_KEY
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    await connectDB();

    const body =
      (await request.json()) as
        Record<
          string,
          unknown
        >;

    const source =
      (
        body.source ??
        'manual'
      ) as
        MedicationEventSource;

    if (
      ![
        'manual',
        'sensor',
        'system',
      ].includes(source)
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            'source must be manual, sensor, or system.',
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Hardware requests must go through the canonical
     * plan/group-validated endpoint.
     */
    if (
      source !== 'manual'
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            'Hardware and system device events must use /api/esp32/event.',
        },
        {
          status: 410,
        }
      );
    }

    const token =
      getTokenFromRequest(
        request
      );

    const auth =
      token
        ? await verifyToken(
            token
          )
        : null;

    if (!auth) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Unauthorized',
        },
        {
          status: 401,
        }
      );
    }

    const userId =
      auth.userId;

    const eventType =
      String(
        body.eventType ??
        'MEDICATION_CONFIRMED'
      ).toUpperCase() as
        MedicationEventType;

    if (
      !EVENT_TYPES.includes(
        eventType
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `eventType must be one of: ${EVENT_TYPES.join(', ')}.`,
        },
        {
          status: 400,
        }
      );
    }

    const chamberId =
      body.chamberId ==
        null
        ? null
        : Number(
            body.chamberId
          );

    const result =
      await processMedicationEvent({
        userId,
        source,
        eventType,

        timestamp:
          typeof body.timestamp ===
            'string'
            ? body.timestamp
            : undefined,

        chamberId,

        medicineId:
          typeof body.medicineId ===
            'string'
            ? body.medicineId
            : null,

        logId:
          typeof body.logId ===
            'string'
            ? body.logId
            : null,

        deviceId:
          typeof body.deviceId ===
            'string'
            ? body.deviceId
            : null,
      });

    return NextResponse.json({
      success: true,
      data: result,
      message:
        result.message,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Internal server error';

    const clientError =
      /required|valid|must|matched|already finalized/i
        .test(message);

    console.error(
      '[POST /api/medication-events]',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status:
          clientError
            ? 400
            : 500,
      }
    );
  }
}

/**
 * Compatibility status check.
 *
 * The canonical ESP32 status endpoint is:
 * GET /api/esp32/event?deviceId=box_1
 */
export async function GET(
  request: NextRequest
) {
  if (
    !sensorAuthorized(
      request
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Unauthorized',
      },
      {
        status: 401,
      }
    );
  }

  return NextResponse.json({
    success: true,

    message:
      'Medication verification event API is online.',

    supportedSources: [
      'manual',
      'sensor',
      'system',
    ],

    supportedEvents:
      EVENT_TYPES,

    hardwareReady:
      true,

    /*
     * This is false because the tray ultrasonic sensor
     * cannot verify a specific medicine or chamber.
     */
    sensorVerificationActive:
      false,
  });
}