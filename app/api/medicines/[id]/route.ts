// app/api/medicines/[id]/route.ts
import {
  NextRequest,
  NextResponse,
} from 'next/server';

import mongoose from 'mongoose';

import {
  connectDB,
} from '@/lib/mongodb';

import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';

import {
  getTokenFromRequest,
  verifyToken,
} from '@/lib/auth';

import type {
  ApiResponse,
} from '@/lib/interfaces/data/Api';

import {
  getMedicationDateKey,
  isValidMedicationDateKey,
} from '@/lib/medicationTime';

async function getAuthUser(
  request: NextRequest
) {
  const token =
    getTokenFromRequest(
      request
    );

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const user =
      await getAuthUser(
        request
      );

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Unauthorized',
        },
        {
          status: 401,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    const {
      id,
    } = await params;

    if (
      !mongoose.isValidObjectId(
        id
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Invalid medicine ID',
        },
        {
          status: 400,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    await connectDB();

    const medicine =
      await Medicine.findOne({
        _id: id,
        userId:
          user.userId,
      });

    if (!medicine) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Medicine not found',
        },
        {
          status: 404,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: medicine,
      },
      {
        status: 200,

        headers: {
          'Content-Type':
            'application/json',
        },
      }
    );
  } catch (error) {
    console.error(
      '[GET /api/medicines/[id]] Error:',
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          'Internal server error',
      },
      {
        status: 500,

        headers: {
          'Content-Type':
            'application/json',
        },
      }
    );
  }
}

const VALID_FREQUENCIES = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'Weekly',
  'As needed',
];

const TIME_REGEX =
  /^(1[0-2]|[1-9]):[0-5][0-9]\s(AM|PM)$/i;

function isValidDate(
  dateString: string
): boolean {
  return isValidMedicationDateKey(
    dateString
  );
}

function isValidTime(
  timeString: string
): boolean {
  return TIME_REGEX.test(
    timeString.trim()
  );
}

function sanitizeMedicineName(
  raw: unknown
): string | null {
  if (
    typeof raw !==
    'string'
  ) {
    return null;
  }

  const trimmed =
    raw.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > 100
  ) {
    return null;
  }

  if (
    !/[a-zA-Z0-9]/.test(
      trimmed
    )
  ) {
    return null;
  }

  if (
    /^[^a-zA-Z0-9]+$/.test(
      trimmed
    )
  ) {
    return null;
  }

  return trimmed;
}

function sanitizeDosage(
  raw: unknown
): string | null {
  if (
    typeof raw !==
    'string'
  ) {
    return null;
  }

  const trimmed =
    raw.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > 50
  ) {
    return null;
  }

  if (
    !/[a-zA-Z0-9]/.test(
      trimmed
    )
  ) {
    return null;
  }

  return trimmed;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateMedicinePayload(
  body: Record<string, unknown>
): ValidationResult {
  const {
    name,
    dosage,
    frequency,
    scheduledTimes,
    startDate,
    endDate,
    pillsPerDose,
    windowBeforeMinutes,
    windowAfterMinutes,
    lateAfterMinutes,
  } = body;

  const cleanName =
    sanitizeMedicineName(
      name
    );

  if (!cleanName) {
    return {
      valid: false,

      error:
        'Medicine name is required, must be 1–100 characters, and must contain at least one letter or digit.',
    };
  }

  const cleanDosage =
    sanitizeDosage(
      dosage
    );

  if (!cleanDosage) {
    return {
      valid: false,

      error:
        'Dosage is required, must be 1–50 characters, and must contain at least one letter or digit.',
    };
  }

  if (
    !frequency ||
    typeof frequency !==
      'string'
  ) {
    return {
      valid: false,

      error:
        'Frequency is required.',
    };
  }

  if (
    !VALID_FREQUENCIES.includes(
      frequency
    )
  ) {
    return {
      valid: false,

      error:
        `Frequency must be one of: ${VALID_FREQUENCIES.join(', ')}.`,
    };
  }

  if (
    !Array.isArray(
      scheduledTimes
    ) ||
    scheduledTimes.length ===
      0
  ) {
    return {
      valid: false,

      error:
        'At least one scheduled time is required.',
    };
  }

  if (
    scheduledTimes.length >
      24
  ) {
    return {
      valid: false,

      error:
        'A maximum of 24 scheduled times is allowed.',
    };
  }

  for (
    const time of
    scheduledTimes
  ) {
    if (
      typeof time !==
        'string' ||
      !isValidTime(time)
    ) {
      return {
        valid: false,

        error:
          `Invalid scheduled time "${String(time)}". Expected format: "H:MM AM" or "H:MM PM".`,
      };
    }
  }

  const normalizedTimes =
    scheduledTimes as string[];

  const uniqueTimes =
    new Set(
      normalizedTimes.map(
        (time) =>
          time
            .trim()
            .toUpperCase()
      )
    );

  if (
    uniqueTimes.size !==
      normalizedTimes.length
  ) {
    return {
      valid: false,

      error:
        'Duplicate scheduled times are not allowed.',
    };
  }

  if (
    startDate !== undefined &&
    startDate !== null &&
    startDate !== ''
  ) {
    if (
      typeof startDate !==
        'string' ||
      !isValidDate(
        startDate
      )
    ) {
      return {
        valid: false,

        error:
          'Start date must be a valid date in YYYY-MM-DD format.',
      };
    }
  }

  if (
    endDate !== undefined &&
    endDate !== null &&
    endDate !== ''
  ) {
    if (
      typeof endDate !==
        'string' ||
      !isValidDate(
        endDate
      )
    ) {
      return {
        valid: false,

        error:
          'End date must be a valid date in YYYY-MM-DD format.',
      };
    }

    const scheduleStart =
      typeof startDate ===
        'string' &&
      startDate
        ? startDate
        : getMedicationDateKey();

    if (
      endDate &&
      endDate < scheduleStart
    ) {
      return {
        valid: false,

        error:
          'End date cannot be before start date.',
      };
    }
  }

  const normalizedPillsPerDose =
    pillsPerDose == null
      ? 1
      : Number(
          pillsPerDose
        );

  if (
    !Number.isInteger(
      normalizedPillsPerDose
    ) ||
    normalizedPillsPerDose <
      1 ||
    normalizedPillsPerDose >
      4
  ) {
    return {
      valid: false,

      error:
        'Pills per scheduled dose must be a whole number from 1 to 4.',
    };
  }

  for (
    const [
      field,
      value,
    ] of Object.entries({
      windowBeforeMinutes,
      windowAfterMinutes,
      lateAfterMinutes,
    })
  ) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      const minutes =
        Number(value);

      if (
        !Number.isInteger(
          minutes
        ) ||
        minutes < 0 ||
        minutes > 720
      ) {
        return {
          valid: false,

          error:
            `${field} must be a whole number from 0 to 720.`,
        };
      }
    }
  }

  if (
    lateAfterMinutes !==
      undefined &&
    windowAfterMinutes !==
      undefined &&
    Number(
      lateAfterMinutes
    ) >
      Number(
        windowAfterMinutes
      )
  ) {
    return {
      valid: false,

      error:
        'Late threshold cannot be longer than the after-window.',
    };
  }

  return {
    valid: true,
  };
}

export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const user =
      await getAuthUser(
        request
      );

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Unauthorized',
        },
        {
          status: 401,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    const {
      id,
    } = await params;

    if (
      !mongoose.isValidObjectId(
        id
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Invalid medicine ID',
        },
        {
          status: 400,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    await connectDB();

    let body:
      Record<string, unknown>;

    try {
      body =
        (await request.json()) as Record<string, unknown>;
    } catch (parseError) {
      console.error(
        '[PUT /api/medicines/[id]] JSON parse error:',
        parseError
      );

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Invalid JSON body.',
        },
        {
          status: 400,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    const validation =
      validateMedicinePayload(
        body
      );

    if (
      !validation.valid
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            validation.error,
        },
        {
          status: 400,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    const name =
      body.name as string;

    const dosage =
      body.dosage as string;

    const frequency =
      body.frequency as string;

    const scheduledTimes =
      body.scheduledTimes as
        string[];

    const notes =
      typeof body.notes ===
        'string'
        ? body.notes
        : undefined;

    const startDate =
      typeof body.startDate ===
        'string'
        ? body.startDate
        : undefined;

    const endDate =
      typeof body.endDate ===
        'string'
        ? body.endDate
        : undefined;

    const pillsPerDose =
      body.pillsPerDose ==
        null
        ? 1
        : Number(
            body.pillsPerDose
          );

    const windowBeforeMinutes =
      body.windowBeforeMinutes ==
        null
        ? 30
        : Number(
            body.windowBeforeMinutes
          );

    const windowAfterMinutes =
      body.windowAfterMinutes ==
        null
        ? 90
        : Number(
            body.windowAfterMinutes
          );

    const lateAfterMinutes =
      body.lateAfterMinutes ==
        null
        ? 30
        : Number(
            body.lateAfterMinutes
          );

    const normalizedTimes =
      scheduledTimes.map(
        (time) =>
          time.trim()
      );

    /*
     * No chamberId is accepted here.
     * The daily Rx Box plan assigns chambers.
     */
    const medicine =
      await Medicine.findOneAndUpdate(
        {
          _id: id,
          userId:
            user.userId,
        },
        {
          name:
            name.trim(),

          dosage:
            dosage.trim(),

          frequency,

          scheduledTimes:
            normalizedTimes,

          pillsPerDose,

          windowBeforeMinutes,

          windowAfterMinutes,

          lateAfterMinutes,

          startDate:
            startDate &&
            startDate.trim()
              ? startDate.trim()
              : undefined,

          endDate:
            endDate &&
            endDate.trim()
              ? endDate.trim()
              : null,

          notes:
            typeof notes ===
              'string'
              ? notes
                  .trim()
                  .slice(
                    0,
                    500
                  )
              : '',

          updatedAt:
            new Date(),
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!medicine) {
      console.warn(
        `[PUT /api/medicines/[id]] Medicine not found: ${id} for user ${user.userId}`
      );

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Medicine not found',
        },
        {
          status: 404,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    try {
      const today =
        getMedicationDateKey();

      /*
       * Only unresolved logs for today are regenerated.
       * Previous days and finalized records are preserved.
       */
      await MedicationLog.deleteMany({
        userId:
          user.userId,

        medicineId:
          id,

        scheduledDate:
          today,

        status: {
          $in: [
            'pending',
            'reminder',
            'dispensed',
          ],
        },
      });

      const isActiveToday =
        medicine.startDate <=
          today &&
        (
          !medicine.endDate ||
          medicine.endDate >=
            today
        );

      if (isActiveToday) {
        for (
          const time of
          normalizedTimes
        ) {
          try {
            await MedicationLog.updateOne(
              {
                userId:
                  user.userId,

                medicineId:
                  id,

                scheduledDate:
                  today,

                scheduledTime:
                  time,

                countsTowardAdherence: {
                  $ne: false,
                },
              },
              {
                $setOnInsert: {
                  userId:
                    user.userId,

                  medicineId:
                    id,

                  medicineName:
                    medicine.name,

                  dosage:
                    medicine.dosage,

                  scheduledDate:
                    today,

                  scheduledTime:
                    time,

                  status:
                    'pending',

                  source:
                    'auto',

                  eventType:
                    'SCHEDULED',

                  expectedChamberId:
                    null,

                  expectedChamberIds:
                    [],

                  windowBeforeMinutes:
                    medicine
                      .windowBeforeMinutes,

                  windowAfterMinutes:
                    medicine
                      .windowAfterMinutes,

                  lateAfterMinutes:
                    medicine
                      .lateAfterMinutes,

                  countsTowardAdherence:
                    true,
                },
              },
              {
                upsert: true,
              }
            );
          } catch (
            upsertError
          ) {
            /*
             * Code 11000 = duplicate key on the unique
             * (userId, medicineId, scheduledDate,
             * scheduledTime) index. This means a concurrent
             * ensureMedicationLogsForDate() call (triggered
             * by a dashboard/plan fetch happening at the
             * same moment as this save) already created the
             * exact same log first. The correct single log
             * already exists - this is the race being
             * guarded against, not a real failure.
             */
            const isDuplicateKeyError =
              typeof upsertError ===
                'object' &&
              upsertError !== null &&
              'code' in upsertError &&
              (upsertError as { code?: number }).code ===
                11000;

            if (!isDuplicateKeyError) {
              throw upsertError;
            }
          }
        }
      }
    } catch (logError) {
      /*
       * The medicine update is already saved. Log refresh
       * failure is recorded without corrupting old history.
       */
      console.error(
        '[PUT /api/medicines/[id]] Error updating medication logs:',
        logError
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: medicine,
        message:
          'Medicine updated successfully',
      },
      {
        status: 200,

        headers: {
          'Content-Type':
            'application/json',
        },
      }
    );
  } catch (error) {
    console.error(
      '[PUT /api/medicines/[id]] Unhandled error:',
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          'Internal server error',
      },
      {
        status: 500,

        headers: {
          'Content-Type':
            'application/json',
        },
      }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const user =
      await getAuthUser(
        request
      );

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Unauthorized',
        },
        {
          status: 401,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    const {
      id,
    } = await params;

    if (
      !mongoose.isValidObjectId(
        id
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Invalid medicine ID',
        },
        {
          status: 400,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    await connectDB();

    /*
     * Soft delete preserves previous medication history.
     */
    const medicine =
      await Medicine.findOneAndUpdate(
        {
          _id: id,
          userId:
            user.userId,
        },
        {
          isActive:
            false,

          updatedAt:
            new Date(),
        },
        {
          new: true,
        }
      );

    if (!medicine) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Medicine not found',
        },
        {
          status: 404,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    const todayString =
      getMedicationDateKey();

    /*
     * Remove only unresolved current/future schedules.
     * Historical and finalized adherence records remain.
     */
    await MedicationLog.deleteMany({
      userId:
        user.userId,

      medicineId:
        medicine._id,

      scheduledDate: {
        $gte:
          todayString,
      },

      status: {
        $in: [
          'pending',
          'reminder',
        ],
      },
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,

        message:
          'Medicine deleted successfully',
      },
      {
        status: 200,

        headers: {
          'Content-Type':
            'application/json',
        },
      }
    );
  } catch (error) {
    console.error(
      '[DELETE /api/medicines/[id]] Error:',
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          'Internal server error',
      },
      {
        status: 500,

        headers: {
          'Content-Type':
            'application/json',
        },
      }
    );
  }
}