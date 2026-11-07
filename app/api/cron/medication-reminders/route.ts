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

import {
  queueAdaptiveNotifications,
} from "@/lib/pwa/adaptiveNotifications";

import {
  recoverRecentMedicationNotifications,
} from "@/lib/pwa/medicationNotifications";

import type {
  ApiResponse,
} from "@/lib/interfaces/data/Api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const secret =
    process.env.CRON_SECRET?.trim();

  if (!secret) return false;

  const authorization =
    request.headers
      .get("authorization")
      ?.trim() || "";

  return safelyCompare(
    authorization,
    `Bearer ${secret}`
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
  if (
    !process.env.CRON_SECRET?.trim()
  ) {
    return noStoreResponse(
      {
        success: false,
        error:
          "The medication reminder scheduler is not configured.",
      },
      503
    );
  }

  if (
    !isAuthorized(request)
  ) {
    return noStoreResponse(
      {
        success: false,
        error: "Unauthorized.",
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

    await queueAdaptiveNotifications();

    await recoverRecentMedicationNotifications();

    return noStoreResponse<MedicationReminderSchedulerResult>(
      {
        success: true,

        message:
          result.errors.length > 0
            ? "Medication reminder scheduler completed with some patient errors."
            : "Medication reminder scheduler completed successfully.",

        data: result,
      },
      200
    );
  } catch (error) {
    console.error(
      "[Medication Reminder Cron]",
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

export async function GET(
  request: NextRequest
) {
  return executeScheduler(request);
}

export async function POST(
  request: NextRequest
) {
  return executeScheduler(request);
}