
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { connectDB } from "@/lib/mongodb";
import Medicine from "@/models/Medicine";
import MedicationLog from "@/models/MedicationLog";

import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";

import type {
  ApiResponse,
} from "@/lib/interfaces/data/Api";

import type {
  IMedicineDocument,
  IMedicineChamberAssignment,
} from "@/models/Medicine";

import {
  getMedicationDateKey,
  isValidMedicationDateKey,
  parseMedicationTimeToMinutes,
} from "@/lib/medicationTime";

const VALID_FREQUENCIES = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Every 4 hours",
  "Every 6 hours",
  "Every 8 hours",
  "Weekly",
  "As needed",
];

const TIME_REGEX =
  /^(1[0-2]|[1-9]):[0-5][0-9]\s(AM|PM)$/i;

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

function isValidTime(value: string): boolean {
  return TIME_REGEX.test(value.trim());
}

function sanitizeMedicineName(
  raw: unknown
): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const value = raw.trim();

  if (
    value.length === 0 ||
    value.length > 100 ||
    !/[a-zA-Z0-9]/.test(value)
  ) {
    return null;
  }

  return value;
}

function sanitizeDosage(
  raw: unknown
): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const value = raw.trim();

  if (
    value.length === 0 ||
    value.length > 50 ||
    !/[a-zA-Z0-9]/.test(value)
  ) {
    return null;
  }

  return value;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface MedicinePayload {
  name: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  pillsPerDose: number;
  chamberAssignments: IMedicineChamberAssignment[];
  windowBeforeMinutes: number;
  windowAfterMinutes: number;
  lateAfterMinutes: number;
  notes: string;
  startDate: string;
  endDate: string | null;
}

function validateMedicinePayload(
  body: Record<string, unknown>
): ValidationResult {
  const {
    name,
    dosage,
    frequency,
    scheduledTimes,
    pillsPerDose,
    chamberAssignments,
    startDate,
    endDate,
    windowBeforeMinutes,
    windowAfterMinutes,
    lateAfterMinutes,
  } = body;

  if (!sanitizeMedicineName(name)) {
    return {
      valid: false,
      error:
        "Medicine name is required, must be 1–100 characters, and must contain at least one letter or digit.",
    };
  }

  if (!sanitizeDosage(dosage)) {
    return {
      valid: false,
      error:
        "Dosage is required, must be 1–50 characters, and must contain at least one letter or digit.",
    };
  }

  if (
    typeof frequency !== "string" ||
    !VALID_FREQUENCIES.includes(frequency)
  ) {
    return {
      valid: false,
      error:
        `Frequency must be one of: ${VALID_FREQUENCIES.join(", ")}.`,
    };
  }

  if (
    !Array.isArray(scheduledTimes) ||
    scheduledTimes.length === 0 ||
    scheduledTimes.length > 24
  ) {
    return {
      valid: false,
      error:
        "Provide between 1 and 24 scheduled times.",
    };
  }

  const scheduleMinutes = new Set<number>();

  for (const time of scheduledTimes) {
    if (
      typeof time !== "string" ||
      !isValidTime(time)
    ) {
      return {
        valid: false,
        error:
          `Invalid scheduled time "${String(time)}".`,
      };
    }

    const minutes =
      parseMedicationTimeToMinutes(time);

    if (
      minutes < 0 ||
      scheduleMinutes.has(minutes)
    ) {
      return {
        valid: false,
        error:
          "Duplicate or invalid scheduled times are not allowed.",
      };
    }

    scheduleMinutes.add(minutes);
  }

  const start =
    typeof startDate === "string" && startDate
      ? startDate
      : getMedicationDateKey();

  if (!isValidMedicationDateKey(start)) {
    return {
      valid: false,
      error:
        "Start date must be a valid YYYY-MM-DD date.",
    };
  }

  if (
    endDate !== undefined &&
    endDate !== null &&
    endDate !== ""
  ) {
    if (
      typeof endDate !== "string" ||
      !isValidMedicationDateKey(endDate) ||
      endDate < start
    ) {
      return {
        valid: false,
        error:
          "End date must be valid and cannot be before the start date.",
      };
    }
  }

  const quantity =
    pillsPerDose == null ? 1 : Number(pillsPerDose);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 4
  ) {
    return {
      valid: false,
      error:
        "Pills per scheduled dose must be a whole number from 1 to 4.",
    };
  }

  if (
    !Array.isArray(chamberAssignments) ||
    chamberAssignments.length !==
      scheduledTimes.length
  ) {
    return {
      valid: false,
      error:
        "Each scheduled time must have a chamber assignment.",
    };
  }

  const assignedMinutes = new Set<number>();
  const chamberTimes = new Map<number, number>();

  for (const rawAssignment of chamberAssignments) {
    if (
      typeof rawAssignment !== "object" ||
      rawAssignment === null
    ) {
      return {
        valid: false,
        error: "Invalid chamber assignment.",
      };
    }

    const assignment = rawAssignment as Record<
      string,
      unknown
    >;

    if (
      typeof assignment.scheduledTime !== "string" ||
      !isValidTime(assignment.scheduledTime)
    ) {
      return {
        valid: false,
        error:
          "Every chamber assignment needs a valid scheduled time.",
      };
    }

    const minutes =
      parseMedicationTimeToMinutes(
        assignment.scheduledTime
      );

    if (
      !scheduleMinutes.has(minutes) ||
      assignedMinutes.has(minutes)
    ) {
      return {
        valid: false,
        error:
          "Chamber assignments must match the medicine's scheduled times exactly.",
      };
    }

    assignedMinutes.add(minutes);

    const chamberIds = assignment.chamberIds;

    if (
      !Array.isArray(chamberIds) ||
      chamberIds.length === 0 ||
      chamberIds.length > 4 ||
      new Set(chamberIds).size !== chamberIds.length ||
      chamberIds.some(
        (id) =>
          typeof id !== "number" ||
          !Number.isInteger(id) ||
          id < 1 ||
          id > 4
      )
    ) {
      return {
        valid: false,
        error:
          "Select one or more unique chambers numbered 1 to 4.",
      };
    }

    for (const chamberId of chamberIds as number[]) {
      const previousTime =
        chamberTimes.get(chamberId);

      if (
        previousTime !== undefined &&
        previousTime !== minutes
      ) {
        return {
          valid: false,
          error:
            `Chamber ${chamberId} cannot be assigned to different dispensing times.`,
        };
      }

      chamberTimes.set(chamberId, minutes);
    }
  }

  for (const [field, value] of Object.entries({
    windowBeforeMinutes,
    windowAfterMinutes,
    lateAfterMinutes,
  })) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      const minutes = Number(value);

      if (
        !Number.isInteger(minutes) ||
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

  const after =
    windowAfterMinutes == null
      ? 90
      : Number(windowAfterMinutes);

  const late =
    lateAfterMinutes == null
      ? 30
      : Number(lateAfterMinutes);

  if (late > after) {
    return {
      valid: false,
      error:
        "Late threshold cannot be longer than the after-window.",
    };
  }

  return { valid: true };
}

function normalizePayload(
  body: Record<string, unknown>
): MedicinePayload {
  return {
    name: (body.name as string).trim(),
    dosage: (body.dosage as string).trim(),
    frequency: body.frequency as string,

    scheduledTimes: (
      body.scheduledTimes as string[]
    ).map((time) => time.trim()),

    pillsPerDose:
      body.pillsPerDose == null
        ? 1
        : Number(body.pillsPerDose),

    chamberAssignments: (
      body.chamberAssignments as
        IMedicineChamberAssignment[]
    ).map((assignment) => ({
      scheduledTime:
        assignment.scheduledTime.trim(),

      chamberIds: [
        ...assignment.chamberIds,
      ].sort((a, b) => a - b),
    })),

    windowBeforeMinutes:
      body.windowBeforeMinutes == null
        ? 30
        : Number(body.windowBeforeMinutes),

    windowAfterMinutes:
      body.windowAfterMinutes == null
        ? 90
        : Number(body.windowAfterMinutes),

    lateAfterMinutes:
      body.lateAfterMinutes == null
        ? 30
        : Number(body.lateAfterMinutes),

    notes:
      typeof body.notes === "string"
        ? body.notes.trim().slice(0, 500)
        : "",

    startDate:
      typeof body.startDate === "string" &&
      body.startDate.trim()
        ? body.startDate.trim()
        : getMedicationDateKey(),

    endDate:
      typeof body.endDate === "string" &&
      body.endDate.trim()
        ? body.endDate.trim()
        : null,
  };
}

/**
 * Check other active medicines belonging to the patient.
 *
 * Sharing a chamber is permitted only when the
 * dispensing times are equal.
 *
 * Date ranges must overlap for a conflict to matter.
 */
async function findChamberConflict(
  userId: string,
  payload: MedicinePayload
): Promise<string | null> {
  const otherMedicines = await Medicine.find({
    userId,
    isActive: true,
  })
    .select(
      "name startDate endDate chamberAssignments"
    )
    .lean();

  for (const other of otherMedicines) {
    const otherStart =
      other.startDate || "0000-01-01";

    const otherEnd =
      other.endDate || "9999-12-31";

    const currentEnd =
      payload.endDate || "9999-12-31";

    const datesOverlap =
      payload.startDate <= otherEnd &&
      otherStart <= currentEnd;

    if (!datesOverlap) {
      continue;
    }

    for (const incoming of payload.chamberAssignments) {
      const incomingMinutes =
        parseMedicationTimeToMinutes(
          incoming.scheduledTime
        );

      for (const existing of other.chamberAssignments ?? []) {
        const existingMinutes =
          parseMedicationTimeToMinutes(
            existing.scheduledTime
          );

        const sharedChambers =
          incoming.chamberIds.filter((id) =>
            existing.chamberIds.includes(id)
          );

        if (
          sharedChambers.length > 0 &&
          incomingMinutes !== existingMinutes
        ) {
          return (
            `Chamber ${sharedChambers.join(", ")} is already ` +
            `assigned to ${other.name} at ` +
            `${existing.scheduledTime}. ` +
            "Choose a different chamber or use the same dispensing time."
          );
        }
      }
    }
  }

  return null;
}

/**
 * One medication log represents one scheduled
 * dose, regardless of pill quantity.
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
): Promise<void> {
  const today = getMedicationDateKey();

  if (
    startDate > today ||
    (endDate && endDate < today)
  ) {
    return;
  }

  for (const time of scheduledTimes) {
    const existing = await MedicationLog.findOne({
      userId,
      medicineId,
      scheduledDate: today,
      scheduledTime: time,
    });

    if (existing) {
      continue;
    }

    await MedicationLog.create({
      userId,
      medicineId,
      medicineName,
      dosage,

      scheduledDate: today,
      scheduledTime: time,

      status: "pending",
      source: "auto",
      eventType: "SCHEDULED",

      expectedChamberId: null,
      expectedChamberIds: [],

      windowBeforeMinutes,
      windowAfterMinutes,
      lateAfterMinutes,

      countsTowardAdherence: true,
    });
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    await connectDB();

    const medicines = await Medicine.find({
      userId: user.userId,
      isActive: true,
    }).sort({
      createdAt: -1,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: medicines,
    });
  } catch (error) {
    console.error(
      "[GET /api/medicines]",
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    await connectDB();

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<
        string,
        unknown
      >;
    } catch {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Invalid JSON body.",
        },
        { status: 400 }
      );
    }

    const validation =
      validateMedicinePayload(body);

    if (!validation.valid) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    const payload = normalizePayload(body);

    const conflict = await findChamberConflict(
      user.userId,
      payload
    );

    if (conflict) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: conflict,
        },
        { status: 409 }
      );
    }

    const medicine: IMedicineDocument =
      await Medicine.create({
        userId: user.userId,

        ...payload,

        isActive: true,
      });

    await createLogsFromStartDate(
      user.userId,
      medicine._id.toString(),
      medicine.name,
      medicine.dosage,
      medicine.scheduledTimes,
      payload.startDate,
      payload.endDate,
      medicine.windowBeforeMinutes,
      medicine.windowAfterMinutes,
      medicine.lateAfterMinutes
    );

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: medicine,
        message: "Medicine added successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "[POST /api/medicines]",
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
