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
  sendWebPushToUser,
  type ChannelDeliveryResult,
} from "@/lib/notificationChannels";

import Notification from "@/models/Notification";

import type {
  NotificationNavigationScreen,
  NotificationType,
} from "@/models/Notification";

import User from "@/models/User";

const TYPES =
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

const SCREENS =
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
  _id: mongoose.Types.ObjectId;
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
    getTokenFromRequest(request);

  return token
    ? verifyToken(token)
    : null;
}

function text(
  value: unknown,
  maximum: number
): string {
  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(0, maximum)
    : "";
}

function optionalText(
  value: unknown,
  maximum: number
) {
  return (
    text(value, maximum) ||
    undefined
  );
}

function objectId(
  value: unknown
) {
  return typeof value ===
    "string" &&
    mongoose.Types.ObjectId.isValid(
      value
    )
    ? new mongoose.Types.ObjectId(
        value
      )
    : undefined;
}

function internalUrl(
  value: unknown
) {
  const url = text(
    value,
    500
  );

  return url &&
    url.startsWith("/") &&
    !url.startsWith("//")
    ? url
    : undefined;
}

function riskLevel(
  value: unknown
): "Low" | "Moderate" | "High" | undefined {
  return value === "Low" ||
    value === "Moderate" ||
    value === "High"
    ? value
    : undefined;
}

function adherenceRate(
  value: unknown
) {
  return typeof value ===
    "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
    ? value
    : undefined;
}

function navigation(
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
        screen: "chats",
        url: "/chats",
      };

    case "monitoring_request":
      return {
        screen: "settings",
        url: "/settings",
      };

    case "monitoring_approved":
    case "monitoring_declined":
    case "monitoring_revoked":
      return {
        screen: "monitoring",
        url: "/monitor",
      };

    case "medication_alert":
    case "critical_alert":
      return {
        screen: "alerts",
        url: "/alerts",
      };

    case "adherence_alert":
    case "food_monitoring_ready":
    case "food_monitoring_alert":
      return {
        screen: "adherence",
        url: "/",
      };

    default:
      return {
        screen: "dashboard",
        url: "/",
      };
  }
}

async function deliver(
  userId: string,
  pushEnabled: boolean,
  payload: Parameters<
    typeof sendWebPushToUser
  >[1]
): Promise<ChannelDeliveryResult> {
  if (!pushEnabled) {
    return {
      status: "SKIPPED",
      sentCount: 0,
      error:
        "Push notifications are disabled for this account.",
    };
  }

  const primary =
    payload.type ===
      "intake_confirmed" ||
    (
      payload.type ===
        "upcoming_reminder" &&
      !payload.title.startsWith(
        "Heads-up:"
      )
    ) ||
    (
      payload.type ===
        "due_alarm" &&
      !payload.title.startsWith(
        "Follow-up Reminder"
      )
    );

  if (primary) {
    return {
      status: "SKIPPED",
      sentCount: 0,
      error:
        "Handled by server medication delivery.",
    };
  }

  try {
    return await sendWebPushToUser(
      userId,
      payload
    );
  } catch (error) {
    console.warn(
      "[Notification API]",
      error
    );

    return {
      status: "FAILED",
      sentCount: 0,
      error:
        "Notification delivery failed.",
    };
  }
}

function failure(
  error: string,
  status: number
) {
  return NextResponse.json<ApiResponse>(
    {
      success: false,
      error,
    },
    {
      status,
    }
  );
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
      return failure(
        "Unauthorized",
        401
      );
    }

    await connectDB();

    const [
      notifications,
      unreadCount,
    ] = await Promise.all([
      Notification.find({
        userId: auth.userId,
      })
        .sort({
          createdAt: -1,
        })
        .limit(50)
        .lean(),

      Notification.countDocuments({
        userId: auth.userId,
        read: false,
      }),
    ]);

    return NextResponse.json<ApiResponse>({
      success: true,
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

    return failure(
      "Internal server error",
      500
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
      return failure(
        "Unauthorized",
        401
      );
    }

    const body =
      await request
        .json()
        .catch(() => ({}));

    const type = text(
      body.type,
      100
    ) as NotificationType;

    const title = text(
      body.title,
      150
    );

    const message = text(
      body.message,
      1500
    );

    if (
      !TYPES.has(type) ||
      !title ||
      !message
    ) {
      return failure(
        "A valid type, title, and message are required.",
        400
      );
    }

    const rawScreen = text(
      body.screen,
      100
    );

    const suppliedScreen =
      SCREENS.has(
        rawScreen as
          NotificationNavigationScreen
      )
        ? rawScreen as
            NotificationNavigationScreen
        : undefined;

    if (
      rawScreen &&
      !suppliedScreen
    ) {
      return failure(
        "Invalid notification screen.",
        400
      );
    }

    const rawUrl = text(
      body.url,
      500
    );

    const suppliedUrl =
      internalUrl(body.url);

    if (
      rawUrl &&
      !suppliedUrl
    ) {
      return failure(
        "Notification URL must be an internal application path.",
        400
      );
    }

    const defaults =
      navigation(type);

    const screen =
      suppliedScreen ||
      defaults.screen;

    const url =
      suppliedUrl ||
      defaults.url;

    const medicineId =
      objectId(body.medicineId);

    const alertId =
      objectId(body.alertId);

    const monitoringRequestId =
      objectId(
        body.monitoringRequestId
      );

    const chatRequestId =
      objectId(
        body.chatRequestId
      );

    const conversationId =
      objectId(
        body.conversationId
      );

    const messageId =
      objectId(body.messageId);

    const medicationLogId =
      objectId(
        body.medicationLogId ||
          body.logId
      );

    const medicineName =
      optionalText(
        body.medicineName,
        200
      );

    const patientId =
      optionalText(
        body.patientId,
        100
      );

    const risk =
      riskLevel(
        body.riskLevel
      );

    const rate =
      adherenceRate(
        body.adherenceRate
      );

    await connectDB();

    const currentUser =
      await User.findOne({
        _id: auth.userId,
        isDeleted: {
          $ne: true,
        },
      })
        .select(
          "_id isDeleted notificationPreferences"
        )
        .lean() as unknown as
          NotificationUser | null;

    if (!currentUser) {
      return failure(
        "User not found",
        404
      );
    }

    const notification =
      await Notification.create({
        userId: currentUser._id,
        type,
        title,
        message,
        screen,
        url,

        ...(medicineId
          ? { medicineId }
          : {}),

        ...(alertId
          ? { alertId }
          : {}),

        ...(monitoringRequestId
          ? {
              monitoringRequestId,
            }
          : {}),

        ...(chatRequestId
          ? { chatRequestId }
          : {}),

        ...(conversationId
          ? { conversationId }
          : {}),

        ...(messageId
          ? { messageId }
          : {}),

        ...(medicationLogId
          ? { medicationLogId }
          : {}),

        ...(medicineName
          ? { medicineName }
          : {}),

        ...(patientId
          ? { patientId }
          : {}),

        ...(risk
          ? { riskLevel: risk }
          : {}),

        ...(rate !== undefined
          ? {
              adherenceRate: rate,
            }
          : {}),

        read: false,
      });

    const delivery =
      await deliver(
        currentUser._id.toString(),
        currentUser
          .notificationPreferences
          ?.push !== false,
        {
          title,
          body: message,
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
          riskLevel: risk,
          severity: risk,
        }
      );

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          notification,
          delivery,
        },
        message:
          delivery.status ===
          "SENT"
            ? "Notification saved and sent to subscribed devices."
            : "Notification saved. Device delivery was handled separately, skipped, or unavailable.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "[POST /api/notifications]",
      error
    );

    return failure(
      "Internal server error",
      500
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
      return failure(
        "Unauthorized",
        401
      );
    }

    const body =
      await request
        .json()
        .catch(() => ({}));

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
      action === "markAllRead"
    ) {
      await Notification.updateMany(
        {
          userId: auth.userId,
        },
        {
          $set: {
            read: true,
          },
        }
      );

      return NextResponse.json<ApiResponse>({
        success: true,
        message:
          "All notifications marked as read",
      });
    }

    if (
      action === "deleteAll"
    ) {
      await Notification.deleteMany({
        userId: auth.userId,
      });

      return NextResponse.json<ApiResponse>({
        success: true,
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
      return failure(
        "A valid notification ID is required.",
        400
      );
    }

    const filter = {
      _id: notificationId,
      userId: auth.userId,
    };

    if (
      action === "delete"
    ) {
      const deleted =
        await Notification.findOneAndDelete(
          filter
        );

      if (!deleted) {
        return failure(
          "Notification not found.",
          404
        );
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        message:
          "Notification deleted",
      });
    }

    if (
      action === "markRead"
    ) {
      const updated =
        await Notification.findOneAndUpdate(
          filter,
          {
            $set: {
              read: true,
            },
          },
          {
            new: true,
          }
        );

      if (!updated) {
        return failure(
          "Notification not found.",
          404
        );
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        message:
          "Notification marked as read",
      });
    }

    return failure(
      "Invalid action",
      400
    );
  } catch (error) {
    console.error(
      "[PATCH /api/notifications]",
      error
    );

    return failure(
      "Internal server error",
      500
    );
  }
}