import mongoose from "mongoose";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";

import type {
  ApiResponse,
} from "@/lib/interfaces/data/Api";

import {
  connectDB,
} from "@/lib/mongodb";

import {
  sendExpoPushToUser,
} from "@/lib/notificationChannels";

import type {
  ChannelDeliveryResult,
} from "@/lib/notificationChannels";

import Notification from "@/models/Notification";

import type {
  NotificationNavigationScreen,
  NotificationType,
} from "@/models/Notification";

import User from "@/models/User";

const NOTIFICATION_TYPES =
  new Set<NotificationType>([
    "upcoming_reminder",
    "due_alarm",
    "intake_confirmed",
    "medication_alert",
    "critical_alert",
    "adherence_alert",
    "food_monitoring_ready",
    "food_monitoring_alert",
    "monitoring_request",
    "monitoring_approved",
    "monitoring_declined",
    "monitoring_revoked",
    "chat_request",
    "chat_request_accepted",
    "chat_request_declined",
    "chat_message",
  ]);

const NOTIFICATION_SCREENS =
  new Set<NotificationNavigationScreen>([
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

interface NotificationUser {
  _id:
    mongoose.Types.ObjectId;

  isDeleted?:
    boolean;

  notificationPreferences?: {
    inApp?: boolean;
    push?: boolean;
    sms?: boolean;
  };
}

async function getAuthUser(
  request: NextRequest
) {
  const token =
    getTokenFromRequest(
      request
    );

  return token
    ? verifyToken(token)
    : null;
}

function requiredString(
  value: unknown,
  maximumLength: number
): string {
  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(
          0,
          maximumLength
        )
    : "";
}

function optionalString(
  value: unknown,
  maximumLength: number
): string | undefined {
  const result =
    requiredString(
      value,
      maximumLength
    );

  return result ||
    undefined;
}

function optionalObjectId(
  value: unknown
):
  | mongoose.Types.ObjectId
  | undefined {
  if (
    typeof value !==
      "string" ||
    !mongoose.Types.ObjectId.isValid(
      value
    )
  ) {
    return undefined;
  }

  return new mongoose.Types.ObjectId(
    value
  );
}

function getNotificationType(
  value: unknown
):
  | NotificationType
  | null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const type =
    value.trim() as
      NotificationType;

  return NOTIFICATION_TYPES.has(
    type
  )
    ? type
    : null;
}

function getNotificationScreen(
  value: unknown
):
  | NotificationNavigationScreen
  | undefined {
  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const screen =
    value.trim() as
      NotificationNavigationScreen;

  return NOTIFICATION_SCREENS.has(
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

  if (
    !url ||
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

function getRiskLevel(
  value: unknown
):
  | "Low"
  | "Moderate"
  | "High"
  | undefined {
  if (
    value ===
      "Low" ||
    value ===
      "Moderate" ||
    value ===
      "High"
  ) {
    return value;
  }

  return undefined;
}

function getAdherenceRate(
  value: unknown
): number | undefined {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value
    ) ||
    value <
      0 ||
    value >
      100
  ) {
    return undefined;
  }

  return value;
}

function defaultNavigation(
  type: NotificationType
): {
  screen:
    NotificationNavigationScreen;

  url: string;
} {
  switch (type) {
    case "chat_request":
    case "chat_request_accepted":
    case "chat_request_declined":
    case "chat_message":
      return {
        screen:
          "chats",

        url:
          "/chats",
      };

    case "monitoring_request":
      return {
        screen:
          "settings",

        url:
          "/settings",
      };

    case "monitoring_approved":
    case "monitoring_declined":
    case "monitoring_revoked":
      return {
        screen:
          "monitoring",

        url:
          "/monitor",
      };

    case "medication_alert":
    case "critical_alert":
      return {
        screen:
          "alerts",

        url:
          "/alerts",
      };

    case "adherence_alert":
    case "food_monitoring_ready":
    case "food_monitoring_alert":
      return {
        screen:
          "adherence",

        url:
          "/",
      };

    case "upcoming_reminder":
    case "due_alarm":
    case "intake_confirmed":
    default:
      return {
        screen:
          "dashboard",

        url:
          "/",
      };
  }
}

async function sendMobileNotification(
  userId: string,
  pushEnabled: boolean,
  payload: Parameters<
    typeof sendExpoPushToUser
  >[1]
): Promise<ChannelDeliveryResult> {
  if (!pushEnabled) {
    return {
      status:
        "SKIPPED",

      sentCount:
        0,

      error:
        "Push notifications are disabled for this account.",
    };
  }

  try {
    return await sendExpoPushToUser(
      userId,
      payload
    );
  } catch (error) {
    console.warn(
      "[Notification API] Mobile delivery failed:",
      error
    );

    return {
      status:
        "FAILED",

      sentCount:
        0,

      error:
        "Mobile notification delivery failed.",
    };
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    const auth =
      await getAuthUser(
        request
      );

    if (!auth) {
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

    await connectDB();

    const [
      notifications,
      unreadCount,
    ] =
      await Promise.all([
        Notification.find({
          userId:
            auth.userId,
        })
          .sort({
            createdAt: -1,
          })
          .limit(
            50
          )
          .lean(),

        Notification.countDocuments(
          {
            userId:
              auth.userId,

            read:
              false,
          }
        ),
      ]);

    return NextResponse.json<ApiResponse>({
      success:
        true,

      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/notifications]",
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

export async function POST(
  request: NextRequest
) {
  try {
    const auth =
      await getAuthUser(
        request
      );

    if (!auth) {
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

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const type =
      getNotificationType(
        body.type
      );

    const title =
      requiredString(
        body.title,
        150
      );

    const message =
      requiredString(
        body.message,
        1500
      );

    if (
      !type ||
      !title ||
      !message
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "A valid type, title, and message are required.",
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

    const suppliedScreen =
      getNotificationScreen(
        body.screen
      );

    if (
      rawScreen &&
      !suppliedScreen
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Invalid notification screen.",
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

    const suppliedUrl =
      getInternalUrl(
        body.url
      );

    if (
      rawUrl &&
      !suppliedUrl
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Notification URL must be an internal application path.",
        },
        {
          status: 400,
        }
      );
    }

    const navigation =
      defaultNavigation(
        type
      );

    const screen =
      suppliedScreen ||
      navigation.screen;

    const url =
      suppliedUrl ||
      navigation.url;

    const medicineId =
      optionalObjectId(
        body.medicineId
      );

    const alertId =
      optionalObjectId(
        body.alertId
      );

    const monitoringRequestId =
      optionalObjectId(
        body.monitoringRequestId
      );

    const chatRequestId =
      optionalObjectId(
        body.chatRequestId
      );

    const conversationId =
      optionalObjectId(
        body.conversationId
      );

    const messageId =
      optionalObjectId(
        body.messageId
      );

    const medicationLogId =
      optionalObjectId(
        body.medicationLogId ||
          body.logId
      );

    const medicineName =
      optionalString(
        body.medicineName,
        200
      );

    const patientId =
      optionalString(
        body.patientId,
        100
      );

    const riskLevel =
      getRiskLevel(
        body.riskLevel
      );

    const adherenceRate =
      getAdherenceRate(
        body.adherenceRate
      );

    await connectDB();

    const rawUser =
      await User.findOne({
        _id:
          auth.userId,

        isDeleted: {
          $ne:
            true,
        },
      })
        .select(
          "_id isDeleted notificationPreferences"
        )
        .lean();

    const currentUser =
      rawUser as unknown as
        | NotificationUser
        | null;

    if (!currentUser) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "User not found",
        },
        {
          status: 404,
        }
      );
    }

    const notification =
      await Notification.create({
        userId:
          currentUser._id,

        type,
        title,
        message,
        screen,
        url,

        ...(medicineId
          ? {
              medicineId,
            }
          : {}),

        ...(alertId
          ? {
              alertId,
            }
          : {}),

        ...(monitoringRequestId
          ? {
              monitoringRequestId,
            }
          : {}),

        ...(chatRequestId
          ? {
              chatRequestId,
            }
          : {}),

        ...(conversationId
          ? {
              conversationId,
            }
          : {}),

        ...(messageId
          ? {
              messageId,
            }
          : {}),

        ...(medicationLogId
          ? {
              medicationLogId,
            }
          : {}),

        ...(medicineName
          ? {
              medicineName,
            }
          : {}),

        ...(patientId
          ? {
              patientId,
            }
          : {}),

        ...(riskLevel
          ? {
              riskLevel,
            }
          : {}),

        ...(adherenceRate !==
        undefined
          ? {
              adherenceRate,
            }
          : {}),

        read:
          false,
      });

    /*
     * This endpoint is currently called by the browser
     * NotificationManager, which already shows its own
     * browser notification.
     *
     * Send only through Expo here to prevent duplicate
     * browser Web Push notifications.
     */
    const delivery =
      await sendMobileNotification(
        currentUser._id.toString(),

        currentUser
          .notificationPreferences
          ?.push !== false,

        {
          title,
          body:
            message,
          type,
          screen,
          url,

          medicineId:
            medicineId?.toString(),

          medicineName,
          patientId,

          alertId:
            alertId?.toString(),

          conversationId:
            conversationId?.toString(),

          messageId:
            messageId?.toString(),

          requestId:
            (
              monitoringRequestId ||
              chatRequestId
            )?.toString(),

          monitoringRequestId:
            monitoringRequestId?.toString(),

          chatRequestId:
            chatRequestId?.toString(),

          logId:
            medicationLogId?.toString(),

          riskLevel,

          severity:
            riskLevel,
        }
      );

    return NextResponse.json<ApiResponse>(
      {
        success:
          true,

        data: {
          notification,
          delivery,
        },

        message:
          delivery.status ===
          "SENT"
            ? "Notification saved and sent to the mobile device."
            : "Notification saved. Mobile delivery was skipped or unavailable.",
      },
      {
        status:
          201,
      }
    );
  } catch (error) {
    console.error(
      "[POST /api/notifications]",
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success:
          false,

        error:
          "Internal server error",
      },
      {
        status:
          500,
      }
    );
  }
}

export async function PATCH(
  request: NextRequest
) {
  try {
    const auth =
      await getAuthUser(
        request
      );

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        {
          success:
            false,

          error:
            "Unauthorized",
        },
        {
          status:
            401,
        }
      );
    }

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const action =
      typeof body.action ===
      "string"
        ? body.action
        : "";

    const notificationId =
      typeof body.notificationId ===
      "string"
        ? body.notificationId.trim()
        : "";

    await connectDB();

    if (
      action ===
      "markAllRead"
    ) {
      await Notification.updateMany(
        {
          userId:
            auth.userId,
        },
        {
          $set: {
            read:
              true,
          },
        }
      );

      return NextResponse.json<ApiResponse>({
        success:
          true,

        message:
          "All notifications marked as read",
      });
    }

    if (
      action ===
      "deleteAll"
    ) {
      await Notification.deleteMany({
        userId:
          auth.userId,
      });

      return NextResponse.json<ApiResponse>({
        success:
          true,

        message:
          "All notifications deleted",
      });
    }

    if (
      !notificationId ||
      !mongoose.Types.ObjectId.isValid(
        notificationId
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success:
            false,

          error:
            "A valid notification ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      action ===
      "delete"
    ) {
      const deleted =
        await Notification.findOneAndDelete(
          {
            _id:
              notificationId,

            userId:
              auth.userId,
          }
        );

      if (!deleted) {
        return NextResponse.json<ApiResponse>(
          {
            success:
              false,

            error:
              "Notification not found.",
          },
          {
            status:
              404,
          }
        );
      }

      return NextResponse.json<ApiResponse>({
        success:
          true,

        message:
          "Notification deleted",
      });
    }

    if (
      action ===
      "markRead"
    ) {
      const updated =
        await Notification.findOneAndUpdate(
          {
            _id:
              notificationId,

            userId:
              auth.userId,
          },
          {
            $set: {
              read:
                true,
            },
          },
          {
            new:
              true,
          }
        );

      if (!updated) {
        return NextResponse.json<ApiResponse>(
          {
            success:
              false,

            error:
              "Notification not found.",
          },
          {
            status:
              404,
          }
        );
      }

      return NextResponse.json<ApiResponse>({
        success:
          true,

        message:
          "Notification marked as read",
      });
    }

    return NextResponse.json<ApiResponse>(
      {
        success:
          false,

        error:
          "Invalid action",
      },
      {
        status:
          400,
      }
    );
  } catch (error) {
    console.error(
      "[PATCH /api/notifications]",
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success:
          false,

        error:
          "Internal server error",
      },
      {
        status:
          500,
      }
    );
  }
}