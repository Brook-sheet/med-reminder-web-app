// app/api/esp32/sched/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Returns the alarm schedule that the ESP32 fetches on boot and every 5 min.
//
// ESP32 fetchSchedule() reads:
//   for (JsonObject obj : doc.as<JsonArray>()) {
//     a.hour   = obj["hour"];
//     a.minute = obj["minute"];
//   }
//
// So this endpoint returns:
//   [ { "hour": 8, "minute": 0 }, { "hour": 20, "minute": 0 }, ... ]
//
// Optional query params:
//   ?userId=<mongoId>   – filter to a single user's medicines
//   ?device=box_1       – future: device-to-user mapping
// ─────────────────────────────────────────────────────────────────────────────

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import mongoose from 'mongoose';

import {
  connectDB,
} from '@/lib/mongodb';

import Medicine from '@/models/Medicine';

import {
  getMedicationDateKey,
} from '@/lib/medicationTime';

const SENSOR_API_KEY =
  process.env.SENSOR_API_KEY ??
  'dev-sensor-key-change-me';

function isAuthorized(
  request: NextRequest,
): boolean {
  if (
    process.env.NODE_ENV !==
    'production'
  ) {
    return true;
  }

  const key =
    request.headers.get(
      'x-api-key',
    ) ??
    request.headers.get(
      'x-sensor-key',
    );

  return key ===
    SENSOR_API_KEY;
}

function parseTime(
  time: string,
): {
  hour: number;
  minute: number;
} | null {
  const twelveHour =
    time.match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
    );

  if (twelveHour) {
    let hour =
      Number.parseInt(
        twelveHour[1],
      );

    const minute =
      Number.parseInt(
        twelveHour[2],
      );

    if (
      twelveHour[3].toUpperCase() ===
        'PM' &&
      hour !== 12
    ) {
      hour += 12;
    }

    if (
      twelveHour[3].toUpperCase() ===
        'AM' &&
      hour === 12
    ) {
      hour = 0;
    }

    return {
      hour,
      minute,
    };
  }

  const plain =
    time.match(
      /^(\d{1,2}):(\d{2})$/,
    );

  if (plain) {
    return {
      hour:
        Number.parseInt(
          plain[1],
        ),

      minute:
        Number.parseInt(
          plain[2],
        ),
    };
  }

  return null;
}

export async function GET(
  request: NextRequest,
) {
  if (
    !isAuthorized(request)
  ) {
    return NextResponse.json(
      {
        error:
          'Unauthorized',
      },
      {
        status:
          401,
      },
    );
  }

  try {
    await connectDB();

    const {
      searchParams,
    } = new URL(
      request.url,
    );

    const rawUserId =
      searchParams.get(
        'userId',
      ) ??
      process.env
        .DEFAULT_DEVICE_USER_ID ??
      null;

    const userId =
      rawUserId &&
      mongoose.isValidObjectId(
        rawUserId,
      )
        ? rawUserId
        : null;

    if (
      rawUserId &&
      !userId
    ) {
      console.warn(
        `[ESP32 Sched] Ignoring invalid userId: ${rawUserId}`,
      );
    }

    const today =
      getMedicationDateKey();

    const query:
      Record<string, unknown> = {
        isActive:
          true,
      };

    if (userId) {
      query.userId =
        userId;

      query.$or = [
        {
          startDate: {
            $lte:
              today,
          },

          endDate:
            null,
        },

        {
          startDate: {
            $lte:
              today,
          },

          endDate: {
            $gte:
              today,
          },
        },

        {
          startDate: {
            $exists:
              false,
          },
        },
      ];
    }

    const medicines =
      await Medicine.find(
        query,
      );

    const alarms:
      Array<{
        hour: number;
        minute: number;
        medicineId: string;
        medicineName: string;
        dosage: string;
        chamberId: number | null;
        windowBeforeMinutes: number;
        windowAfterMinutes: number;
      }> = [];

    for (
      const medicine of medicines
    ) {
      for (
        const timeString of
        medicine.scheduledTimes as
          string[]
      ) {
        const parsed =
          parseTime(
            timeString,
          );

        if (parsed) {
          alarms.push({
            hour:
              parsed.hour,

            minute:
              parsed.minute,

            medicineId:
              (
                medicine._id as {
                  toString(): string;
                }
              ).toString(),

            medicineName:
              medicine.name as string,

            dosage:
              medicine.dosage as string,

            chamberId:
              medicine.chamberId ??
              null,

            windowBeforeMinutes:
              medicine.windowBeforeMinutes ??
              30,

            windowAfterMinutes:
              medicine.windowAfterMinutes ??
              90,
          });
        }
      }
    }

    alarms.sort(
      (first, second) =>
        first.hour * 60 +
        first.minute -
        (
          second.hour * 60 +
          second.minute
        ),
    );

    // Do not deduplicate by time. Two medicines scheduled at 8:00 AM are
    // separate expected chamber events and must both reach the device.
    console.log(
      `[ESP32 Sched] Returning ${alarms.length} alarm(s)`,
    );

    return NextResponse.json(
      alarms,
    );
  } catch (error) {
    console.error(
      '[GET /api/esp32/sched]',
      error,
    );

    return NextResponse.json(
      {
        error:
          'Internal server error',

        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status:
          500,
      },
    );
  }
}