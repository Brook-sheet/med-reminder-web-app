import mongoose from "mongoose";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import type {
  ApiResponse,
} from "@/lib/interfaces/data/Api";

import {
  connectDB,
} from "@/lib/mongodb";

import {
  sendWebPushToUser,
} from "@/lib/notificationChannels";

import type {
  NotificationPayload,
  NotificationScreen,
} from "@/lib/notificationChannels";

const VALID_NOTIFICATION_SCREENS =
  new Set<NotificationScreen>([
    "dashboard",
    "alerts",
    "monitoring",
    "chats",
    "history",
    "medicines",
    "adherence",
    "settings",
    "account",
    "patient_dashboard",
  ]);

function getRequiredString(
  value: unknown,
  maximumLength: number
): string {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .trim()
    .slice(
      0,
      maximumLength
    );
}

function getOptionalString(
  value: unknown,
  maximumLength: number
): string | undefined {
  const result =
    getRequiredString(
      value,
      maximumLength
    );

  return result ||
    undefined;
}

function getNotificationScreen(
  value: unknown
):
  | NotificationScreen
  | undefined {
  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const screen =
    value.trim() as
      NotificationScreen;

  return VALID_NOTIFICATION_SCREENS.has(
    screen
  )
    ? screen
    : undefined;
}

function getInternalUrl(
  value: unknown
): string | undefined {
  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const url =
    value
      .trim()
      .slice(
        0,
        500
      );

  if (!url) {
    return undefined;
  }

  /*
   * Notification URLs must remain inside the application.
   * This prevents a push payload from redirecting users to
   * an arbitrary external website.
   */
  if (
    !url.startsWith(
      "/"
    ) ||
    url.startsWith(
      "//"
    )
  ) {
    return undefined;
  }

  return url;
}

export async function POST(
  request: NextRequest
) {
  const expectedInternalKey =
    process.env
      .INTERNAL_API_KEY;

  const suppliedInternalKey =
    request.headers.get(
      "x-internal-key"
    );

  if (
    !expectedInternalKey ||
    suppliedInternalKey !==
      expectedInternalKey
  ) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const userId =
      getRequiredString(
        body.userId,
        100
      );

    const title =
      getRequiredString(
        body.title,
        150
      );

    const notificationBody =
      getRequiredString(
        body.body,
        1500
      );

    if (
      !userId ||
      !title ||
      !notificationBody
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "userId, title, and body are required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        userId
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "A valid userId is required.",
        },
        {
          status: 400,
        }
      );
    }

    const rawScreen =
      typeof body.screen ===
      "string"
        ? body.screen.trim()
        : "";

    const screen =
      getNotificationScreen(
        body.screen
      );

    if (
      rawScreen &&
      !screen
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "The notification screen is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const rawUrl =
      typeof body.url ===
      "string"
        ? body.url.trim()
        : "";

    const url =
      getInternalUrl(
        body.url
      );

    if (
      rawUrl &&
      !url
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "The notification URL must be an internal application path.",
        },
        {
          status: 400,
        }
      );
    }

    await connectDB();

    const payload:
      NotificationPayload = {
      title,
      body:
        notificationBody,

      type:
        getOptionalString(
          body.type,
          100
        ) ||
        "adherence_alert",

      screen,

      url:
        url ||
        "/",

      severity:
        getOptionalString(
          body.severity,
          40
        ) ||
        getOptionalString(
          body.riskLevel,
          40
        ),

      riskLevel:
        getOptionalString(
          body.riskLevel,
          40
        ),

      alertId:
        getOptionalString(
          body.alertId,
          100
        ),

      medicineId:
        getOptionalString(
          body.medicineId,
          100
        ),

      medicineName:
        getOptionalString(
          body.medicineName,
          200
        ),

      patientId:
        getOptionalString(
          body.patientId,
          100
        ),

      conversationId:
        getOptionalString(
          body.conversationId,
          100
        ),

      messageId:
        getOptionalString(
          body.messageId,
          100
        ),

      requestId:
        getOptionalString(
          body.requestId,
          100
        ),

      monitoringRequestId:
        getOptionalString(
          body.monitoringRequestId,
          100
        ),

      chatRequestId:
        getOptionalString(
          body.chatRequestId,
          100
        ),

      logId:
        getOptionalString(
          body.logId,
          100
        ),
    };

    const result =
      await sendWebPushToUser(
        userId,
        payload
      );

    if (
      result.status ===
      "FAILED"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            result.error ||
            "Push notification delivery failed.",

          data:
            result,
        },
        {
          status: 502,
        }
      );
    }

    if (
      result.status ===
      "SKIPPED"
    ) {
      return NextResponse.json<ApiResponse>({
        success: true,
        message:
          result.error ||
          "No notification delivery channel was available.",
        data:
          result,
      });
    }

    return NextResponse.json<ApiResponse>({
      success: true,

      message:
        `Sent ${result.sentCount || 0} notification(s).`,

      data:
        result,
    });
  } catch (error) {
    console.error(
      "[POST /api/push/send]",
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}