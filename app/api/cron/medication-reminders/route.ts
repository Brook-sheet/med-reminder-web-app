import {
  timingSafeEqual,
} from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  connectDB,
} from "@/lib/mongodb";

import {
  runMedicationReminderScheduler,
  type MedicationReminderSchedulerResult,
} from "@/lib/medicationReminderScheduler";

import type {
  ApiResponse,
} from "@/lib/interfaces/data/Api";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

function safelyCompare(
  provided: string,
  expected: string
): boolean {
  const providedBuffer =
    Buffer.from(
      provided,
      "utf8"
    );

  const expectedBuffer =
    Buffer.from(
      expected,
      "utf8"
    );

  if (
    providedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    providedBuffer,
    expectedBuffer
  );
}

function isAuthorized(
  request: NextRequest
): boolean {
  const cronSecret =
    process.env
      .CRON_SECRET
      ?.trim();

  if (!cronSecret) {
    return false;
  }

  const authorization =
    request.headers
      .get("authorization")
      ?.trim() || "";

  const expectedAuthorization =
    `Bearer ${cronSecret}`;

  return safelyCompare(
    authorization,
    expectedAuthorization
  );
}

function noStoreResponse<T>(
  body: ApiResponse<T>,
  status: number
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}

async function executeScheduler(
  request: NextRequest
) {
  const cronSecret =
    process.env
      .CRON_SECRET
      ?.trim();

  if (!cronSecret) {
    console.error(
      "[Medication Reminder Cron] CRON_SECRET is not configured."
    );

    return noStoreResponse(
      {
        success: false,
        error:
          "The medication reminder scheduler is not configured.",
      },
      503
    );
  }

  if (!isAuthorized(request)) {
    console.warn(
      "[Medication Reminder Cron] Unauthorized scheduler request."
    );

    return noStoreResponse(
      {
        success: false,
        error:
          "Unauthorized.",
      },
      401
    );
  }

  try {
    await connectDB();

    const result =
      await runMedicationReminderScheduler(
        new Date()
      );

    const hasPartialErrors =
      result.errors.length > 0;

    return noStoreResponse<MedicationReminderSchedulerResult>(
      {
        success: true,

        message:
          hasPartialErrors
            ? "Medication reminder scheduler completed with some patient errors."
            : "Medication reminder scheduler completed successfully.",

        data:
          result,
      },
      200
    );
  } catch (error) {
    console.error(
      "[Medication Reminder Cron] Scheduler failed:",
      error
    );

    return noStoreResponse(
      {
        success: false,
        error:
          "The medication reminder scheduler failed.",
      },
      500
    );
  }
}

/*
 * Vercel Cron invokes the route using GET.
 */
export async function GET(
  request: NextRequest
) {
  return executeScheduler(
    request
  );
}

/*
 * POST is also supported for authorized manual
 * testing or another external scheduler.
 */
export async function POST(
  request: NextRequest
) {
  return executeScheduler(
    request
  );
}