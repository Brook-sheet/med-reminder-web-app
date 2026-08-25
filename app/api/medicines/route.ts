// app/api/medicines/route.ts
import {
  NextRequest,
  NextResponse,
} from 'next/server';

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

import type {
  IMedicineDocument,
} from '@/models/Medicine';

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
    typeof raw !== 'string'
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
    typeof raw !== 'string'
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

  const normalizedScheduledTimes =
    scheduledTimes as string[];

  const uniqueTimes =
    new Set(
      normalizedScheduledTimes.map(
        (time) =>
          time
            .trim()
            .toUpperCase()
      )
    );

  if (
    uniqueTimes.size !==
      scheduledTimes.length
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

    const normalizedStartDate =
      typeof startDate ===
        'string' &&
      startDate
        ? startDate
        : getMedicationDateKey();

    if (
      endDate <
      normalizedStartDate
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

/**
 * Creates scheduled-dose logs for today when the newly
 * created medicine is active today.
 *
 * pillsPerDose is intentionally not expanded here.
 * One scheduled dose remains one adherence log.
 */
async function createLogsFromStartDate(
  userId: string,
  medicineId: string,
  medicineName: string,
  dosage: string,
  scheduledTimes: string[],
  startDate: string,
  endDate: string | null,
  windowBeforeMinutes: number,
  windowAfterMinutes: number,
  lateAfterMinutes: number
) {
  const today =
    getMedicationDateKey();

  if (
    startDate > today ||
    (
      endDate &&
      endDate < today
    )
  ) {
    return;
  }

  for (
    const time of
    scheduledTimes
  ) {
    const existing =
      await MedicationLog.findOne({
        userId,
        medicineId,
        scheduledDate:
          today,
        scheduledTime:
          time,
      });

    if (!existing) {
      await MedicationLog.create({
        userId,
        medicineId,
        medicineName,
        dosage,

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

        windowBeforeMinutes,

        windowAfterMinutes,

        lateAfterMinutes,

        countsTowardAdherence:
          true,
      });
    }
  }
}

export async function GET(
  request: NextRequest
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
        }
      );
    }

    await connectDB();

    const medicines =
      await Medicine.find({
        userId:
          user.userId,

        isActive:
          true,
      }).sort({
        createdAt:
          -1,
      });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: medicines,
    });
  } catch (error) {
    console.error(
      '[GET /api/medicines]',
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
      }
    );
  }
}

export async function POST(
  request: NextRequest
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
        }
      );
    }

    await connectDB();

    let body:
      Record<string, unknown>;

    try {
      body =
        (await request.json()) as
          Record<
            string,
            unknown
          >;
    } catch {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Invalid JSON body.',
        },
        {
          status: 400,
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
        }
      );
    }

    const name =
      (
        body.name as string
      ).trim();

    const dosage =
      (
        body.dosage as string
      ).trim();

    const frequency =
      body.frequency as string;

    const rawScheduledTimes =
      body.scheduledTimes as
        string[];

    const scheduledTimes =
      rawScheduledTimes.map(
        (time) =>
          time.trim()
      );

    const notes =
      typeof body.notes ===
        'string'
        ? body.notes
            .trim()
            .slice(
              0,
              500
            )
        : '';

    const startDate =
      typeof body.startDate ===
        'string' &&
      body.startDate.trim()
        ? body.startDate.trim()
        : getMedicationDateKey();

    const endDate =
      typeof body.endDate ===
        'string' &&
      body.endDate.trim()
        ? body.endDate.trim()
        : null;

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

    /*
     * No chamberId is accepted or assigned here.
     * The daily Rx Box plan owns chamber allocation.
     */
    const medicine:
      IMedicineDocument =
        await Medicine.create({
          userId:
            user.userId,

          name,

          dosage,

          frequency,

          scheduledTimes,

          pillsPerDose,

          windowBeforeMinutes,

          windowAfterMinutes,

          lateAfterMinutes,

          startDate,

          endDate,

          notes,

          isActive:
            true,
        });

    const medicineScheduledTimes =
      medicine.scheduledTimes as
        string[];

    await createLogsFromStartDate(
      user.userId,
      medicine._id.toString(),
      medicine.name,
      medicine.dosage,
      medicineScheduledTimes,
      startDate,
      endDate,
      medicine.windowBeforeMinutes,
      medicine.windowAfterMinutes,
      medicine.lateAfterMinutes
    );

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: medicine,
        message:
          'Medicine added successfully',
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      '[POST /api/medicines]',
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
      }
    );
  }
}