import mongoose from "mongoose";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";

import {
  ensureAcceptedConversation,
} from "@/lib/chatRelationship";

import type {
  ApiResponse,
} from "@/lib/interfaces/data/Api";

import {
  connectDB,
} from "@/lib/mongodb";

import {
  sendWebPushToUser,
} from "@/lib/notificationChannels";

import ChatRequest from "@/models/ChatRequest";
import Notification from "@/models/Notification";
import User from "@/models/User";

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

function publicUser(user: {
  _id:
    mongoose.Types.ObjectId;

  firstName?: string;
  middleName?: string;
  lastName?: string;

  patientId?: string;
  familyId?: string;

  role?:
    | "patient"
    | "family";
}) {
  const role =
    user.role ===
    "family"
      ? "family"
      : "patient";

  return {
    userId:
      user._id.toString(),

    name:
      [
        user.firstName,
        user.middleName,
        user.lastName,
      ]
        .filter(
          Boolean
        )
        .join(
          " "
        )
        .trim() ||
      "Unknown user",

    role,

    identifier:
      role ===
      "family"
        ? user.familyId ??
          ""
        : user.patientId ??
          "",
  };
}

async function sendChatResponsePush(
  userId: string,
  pushEnabled: boolean,
  payload: Parameters<
    typeof sendWebPushToUser
  >[1]
): Promise<void> {
  if (!pushEnabled) {
    return;
  }

  try {
    const result =
      await sendWebPushToUser(
        userId,
        payload
      );

    if (
      result.status ===
      "FAILED"
    ) {
      console.warn(
        "[Chat Response Push] Delivery failed:",
        result.error
      );
    }
  } catch (error) {
    /*
     * Push failure must not reverse a completed request
     * acceptance or decline operation.
     */
    console.warn(
      "[Chat Response Push] Unexpected delivery error:",
      error
    );
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
      receivedDocs,
      sentDocs,
    ] =
      await Promise.all([
        ChatRequest.find({
          recipientId:
            auth.userId,

          status:
            "pending",
        })
          .sort({
            createdAt: -1,
          })
          .populate(
            "requesterId",
            "firstName middleName lastName patientId familyId role"
          )
          .lean(),

        ChatRequest.find({
          requesterId:
            auth.userId,

          status: {
            $in: [
              "pending",
              "declined",
            ],
          },
        })
          .sort({
            updatedAt: -1,
          })
          .limit(
            20
          )
          .populate(
            "recipientId",
            "firstName middleName lastName patientId familyId role"
          )
          .lean(),
      ]);

    type PopulatedUser =
      Parameters<
        typeof publicUser
      >[0];

    const received =
      receivedDocs
        .filter(
          (
            item
          ) =>
            item.requesterId
        )
        .map(
          (
            item
          ) => ({
            requestId:
              item._id.toString(),

            user:
              publicUser(
                item.requesterId as unknown as PopulatedUser
              ),

            status:
              item.status,

            direction:
              "received" as const,

            createdAt:
              item.createdAt,

            respondedAt:
              item.respondedAt ??
              null,
          })
        );

    const sent =
      sentDocs
        .filter(
          (
            item
          ) =>
            item.recipientId
        )
        .map(
          (
            item
          ) => ({
            requestId:
              item._id.toString(),

            user:
              publicUser(
                item.recipientId as unknown as PopulatedUser
              ),

            status:
              item.status,

            direction:
              "sent" as const,

            createdAt:
              item.createdAt,

            respondedAt:
              item.respondedAt ??
              null,
          })
        );

    return NextResponse.json<ApiResponse>({
      success: true,

      data: {
        received,
        sent,

        pendingReceivedCount:
          received.length,
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/chats/requests]",
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

    const requestId =
      typeof body.requestId ===
      "string"
        ? body.requestId.trim()
        : "";

    const action =
      body.action as
        | "accept"
        | "decline"
        | undefined;

    if (
      !mongoose.Types.ObjectId.isValid(
        requestId
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Invalid Message Request ID.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      action !==
        "accept" &&
      action !==
        "decline"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Action must be accept or decline.",
        },
        {
          status: 400,
        }
      );
    }

    await connectDB();

    const currentUser =
      await User.findById(
        auth.userId
      ).select(
        "_id firstName lastName role isDeleted"
      );

    if (
      !currentUser ||
      currentUser.isDeleted
    ) {
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

    const chatRequest =
      await ChatRequest.findOne(
        {
          _id:
            requestId,

          recipientId:
            currentUser._id,

          status:
            "pending",
        }
      );

    if (!chatRequest) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "This pending Message Request was not found or is not addressed to you.",
        },
        {
          status: 404,
        }
      );
    }

    const nextStatus =
      action ===
      "accept"
        ? "accepted"
        : "declined";

    chatRequest.status =
      nextStatus;

    chatRequest.respondedAt =
      new Date();

    await chatRequest.save();

    let conversationId:
      | string
      | null = null;

    if (
      nextStatus ===
      "accepted"
    ) {
      const conversation =
        await ensureAcceptedConversation(
          chatRequest.requesterId,
          chatRequest.recipientId
        );

      if (
        chatRequest.requestedContactName
      ) {
        conversation.contactNames.set(
          chatRequest.requesterId.toString(),
          chatRequest.requestedContactName
        );

        await conversation.save();
      }

      conversationId =
        conversation._id.toString();
    }

    await Notification.updateMany(
      {
        userId:
          currentUser._id,

        type:
          "chat_request",

        chatRequestId:
          chatRequest._id,
      },
      {
        $set: {
          read:
            true,
        },
      }
    );

    const responderName =
      `${currentUser.firstName ?? ""} ${
        currentUser.lastName ?? ""
      }`.trim() ||
      "The recipient";

    const notificationType =
      nextStatus ===
      "accepted"
        ? "chat_request_accepted"
        : "chat_request_declined";

    const notificationTitle =
      nextStatus ===
      "accepted"
        ? "Message Request Accepted"
        : "Message Request Declined";

    const notificationMessage =
      nextStatus ===
      "accepted"
        ? `${responderName} accepted your Message Request.`
        : `${responderName} declined your Message Request.`;

    /*
     * Remove older acceptance or decline notifications
     * for this same Message Request.
     */
    await Notification.deleteMany({
      userId:
        chatRequest.requesterId,

      chatRequestId:
        chatRequest._id,

      type: {
        $in: [
          "chat_request_accepted",
          "chat_request_declined",
        ],
      },
    });

    /*
     * conversationId is included only when the request was
     * accepted. Declined requests do not have a conversation.
     */
    await Notification.create({
      userId:
        chatRequest.requesterId,

      type:
        notificationType,

      title:
        notificationTitle,

      message:
        notificationMessage,

      screen:
        "chats",

      url:
        "/chats",

      chatRequestId:
        chatRequest._id,

      ...(conversationId
        ? {
            conversationId:
              new mongoose.Types.ObjectId(
                conversationId
              ),
          }
        : {}),

      read:
        false,
    });

    const requester =
      await User.findOne({
        _id:
          chatRequest.requesterId,

        isDeleted: {
          $ne: true,
        },
      })
        .select(
          "notificationPreferences"
        )
        .lean();

    if (requester) {
      await sendChatResponsePush(
        chatRequest.requesterId.toString(),

        requester
          .notificationPreferences
          ?.push !== false,

        {
          title:
            notificationTitle,

          body:
            notificationMessage,

          type:
            notificationType,

          screen:
            "chats",

          url:
            "/chats",

          requestId:
            chatRequest._id.toString(),

          chatRequestId:
            chatRequest._id.toString(),

          conversationId:
            conversationId ||
            undefined,
        }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,

      message:
        nextStatus ===
        "accepted"
          ? "Message Request accepted. Chat is now available."
          : "Message Request declined.",

      data: {
        requestId:
          chatRequest._id.toString(),

        status:
          nextStatus,

        conversationId,
      },
    });
  } catch (error) {
    console.error(
      "[PATCH /api/chats/requests]",
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