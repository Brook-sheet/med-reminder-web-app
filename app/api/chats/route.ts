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
  findPairConversation,
  isConversationActiveForPair,
  makeParticipantKey,
} from "@/lib/chatRelationship";

import type {
  ConversationSummary,
} from "@/lib/interfaces/data/Chat";

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
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import MonitoringRequest from "@/models/MonitoringRequest";
import Notification from "@/models/Notification";
import User from "@/models/User";

const TYPING_TTL_MS = 6000;

interface ChatTargetUser {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  patientId?: string;
  familyId?: string;
  role: "patient" | "family";
  isDeleted?: boolean;

  notificationPreferences?: {
    inApp?: boolean;
    push?: boolean;
    sms?: boolean;
    smsPhoneNumber?: string;
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

async function sendChatRequestPush(
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
        "[Chat Request Push] Delivery failed:",
        result.error
      );
    }
  } catch (error) {
    /*
     * Push failure must not cancel an already-created
     * Message Request.
     */
    console.warn(
      "[Chat Request Push] Unexpected delivery error:",
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
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    await connectDB();

    const conversations =
      await Conversation.find({
        participants:
          auth.userId,

        deletedFor: {
          $ne:
            auth.userId,
        },
      })
        .sort({
          lastMessageAt: -1,
          updatedAt: -1,
        })
        .populate(
          "participants",
          "firstName lastName patientId familyId role"
        )
        .lean();

    const now =
      Date.now();

    const summaries:
      ConversationSummary[] =
      await Promise.all(
        conversations.map(
          async (
            conversation
          ) => {
            type PopulatedUser = {
              _id: {
                toString():
                  string;
              };

              firstName?: string;
              lastName?: string;
              patientId?: string;
              familyId?: string;

              role?:
                | "patient"
                | "family";
            };

            const participants =
              conversation.participants as unknown as PopulatedUser[];

            const other =
              participants.find(
                (
                  participant
                ) =>
                  participant._id.toString() !==
                  auth.userId
              );

            const contactNames =
              conversation.contactNames as unknown as Record<
                string,
                string
              >;

            const customName =
              conversation.contactNames?.get?.(
                auth.userId
              ) ||
              contactNames?.[
                auth.userId
              ];

            const fallbackName =
              other
                ? `${other.firstName ?? ""} ${
                    other.lastName ?? ""
                  }`.trim()
                : "Unknown user";

            const contactAvatars =
              conversation.contactAvatars as unknown as Record<
                string,
                string
              >;

            const customAvatar =
              conversation.contactAvatars?.get?.(
                auth.userId
              ) ||
              contactAvatars?.[
                auth.userId
              ];

            const unreadCount =
              await Message.countDocuments(
                {
                  conversationId:
                    conversation._id,

                  recipientId:
                    auth.userId,

                  status: {
                    $ne:
                      "read",
                  },
                }
              );

            let isTyping =
              false;

            if (other) {
              const typingMap =
                conversation.typing as unknown as
                  | Map<
                      string,
                      Date
                    >
                  | Record<
                      string,
                      Date
                    >
                  | undefined;

              const otherId =
                other._id.toString();

              const rawTimestamp =
                typingMap instanceof
                Map
                  ? typingMap.get(
                      otherId
                    )
                  : typingMap?.[
                      otherId
                    ];

              if (
                rawTimestamp
              ) {
                const timestamp =
                  new Date(
                    rawTimestamp
                  ).getTime();

                isTyping =
                  now -
                    timestamp <
                  TYPING_TTL_MS;
              }
            }

            return {
              conversationId:
                conversation._id.toString(),

              contact: {
                userId:
                  other?._id.toString() ??
                  "",

                name:
                  customName ||
                  fallbackName ||
                  "Unknown user",

                identifier:
                  other?.role ===
                  "family"
                    ? other.familyId ??
                      ""
                    : other?.patientId ??
                      "",

                role:
                  other?.role ??
                  "patient",

                avatarUrl:
                  customAvatar ||
                  null,
              },

              lastMessage:
                conversation.lastMessageText
                  ? {
                      text:
                        conversation.lastMessageText,

                      senderId:
                        conversation.lastMessageSenderId?.toString() ??
                        "",

                      createdAt:
                        conversation.lastMessageAt
                          ? new Date(
                              conversation.lastMessageAt
                            ).toISOString()
                          : "",
                    }
                  : null,

              unreadCount,

              updatedAt: (
                conversation.lastMessageAt ??
                conversation.updatedAt ??
                conversation.createdAt
              ) as unknown as string,

              isTyping,
            };
          }
        )
      );

    const normalized =
      summaries.map(
        (
          summary
        ) => ({
          ...summary,

          updatedAt:
            new Date(
              summary.updatedAt
            ).toISOString(),
        })
      );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: normalized,
    });
  } catch (error) {
    console.error(
      "[GET /api/chats]",
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
          error: "Unauthorized",
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

    const identifier =
      typeof body.identifier ===
      "string"
        ? body.identifier
            .trim()
            .toUpperCase()
        : "";

    const monitoringRequestId =
      typeof body.monitoringRequestId ===
      "string"
        ? body.monitoringRequestId.trim()
        : "";

    const contactName =
      typeof body.contactName ===
      "string"
        ? body.contactName
            .trim()
            .slice(
              0,
              80
            )
        : "";

    if (
      !identifier &&
      !monitoringRequestId
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "An account ID is required.",
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
        "role patientId familyId firstName lastName isDeleted"
      );

    if (
      !currentUser ||
      currentUser.isDeleted
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "User not found",
        },
        {
          status: 404,
        }
      );
    }

    let targetUser:
      | ChatTargetUser
      | null = null;

    if (
      monitoringRequestId
    ) {
      if (
        !mongoose.Types.ObjectId.isValid(
          monitoringRequestId
        )
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              "Invalid monitoring request ID.",
          },
          {
            status: 400,
          }
        );
      }

      const monitoring =
        await MonitoringRequest.findOne(
          {
            _id:
              monitoringRequestId,

            status:
              "approved",

            $or: [
              {
                patientId:
                  currentUser._id,
              },
              {
                familyId:
                  currentUser._id,
              },
            ],
          }
        ).lean();

      if (!monitoring) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              "An approved monitoring relationship is required for this action.",
          },
          {
            status: 403,
          }
        );
      }

      const targetId =
        monitoring.patientId.toString() ===
        currentUser._id.toString()
          ? monitoring.familyId
          : monitoring.patientId;

      const foundTarget =
        await User.findById(
          targetId
        )
          .select(
            "_id firstName lastName patientId familyId role isDeleted notificationPreferences"
          )
          .lean();

      targetUser =
        foundTarget as unknown as
          | ChatTargetUser
          | null;
    } else {
      const isPatient =
        currentUser.role ===
        "patient";

      const expectedPrefix =
        isPatient
          ? "FM-"
          : "PT-";

      if (
        !identifier.startsWith(
          expectedPrefix
        )
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,

            error:
              isPatient
                ? "Enter a valid Family ID beginning with FM-."
                : "Enter a valid Patient ID beginning with PT-.",
          },
          {
            status: 400,
          }
        );
      }

      const foundTarget =
        await User.findOne({
          ...(isPatient
            ? {
                familyId:
                  identifier,
              }
            : {
                patientId:
                  identifier,
              }),

          role:
            isPatient
              ? "family"
              : "patient",

          isDeleted: {
            $ne: true,
          },
        })
          .select(
            "_id firstName lastName patientId familyId role isDeleted notificationPreferences"
          )
          .lean();

      targetUser =
        foundTarget as unknown as
          | ChatTargetUser
          | null;
    }

    if (
      !targetUser ||
      targetUser.isDeleted
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "No matching account was found with this ID.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      targetUser._id.toString() ===
      currentUser._id.toString()
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "You cannot send a Message Request to yourself.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      targetUser.role ===
      currentUser.role
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Chat requests are available only between Patient and Family accounts.",
        },
        {
          status: 403,
        }
      );
    }

    const pairKey =
      makeParticipantKey(
        currentUser._id,
        targetUser._id
      );

    let chatRequest =
      await ChatRequest.findOne({
        pairKey,
      });

    if (
      chatRequest?.status ===
      "accepted"
    ) {
      const conversation =
        await findPairConversation(
          currentUser._id,
          targetUser._id
        );

      if (
        isConversationActiveForPair(
          conversation,
          currentUser._id,
          targetUser._id
        )
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              "This person is already an accepted Chat contact.",

            data: {
              status:
                "accepted",

              conversationId:
                conversation?._id.toString() ??
                null,
            },
          },
          {
            status: 409,
          }
        );
      }
    }

    if (
      chatRequest?.status ===
      "pending"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "A Message Request is already pending between these accounts.",

          data: {
            status:
              "pending",

            requestId:
              chatRequest._id.toString(),
          },
        },
        {
          status: 409,
        }
      );
    }

    if (chatRequest) {
      chatRequest.requesterId =
        currentUser._id;

      chatRequest.recipientId =
        targetUser._id;

      chatRequest.status =
        "pending";

      chatRequest.respondedAt =
        null;

      chatRequest.requestedContactName =
        contactName;

      await chatRequest.save();
    } else {
      try {
        chatRequest =
          await ChatRequest.create({
            requesterId:
              currentUser._id,

            recipientId:
              targetUser._id,

            pairKey,

            status:
              "pending",

            requestedContactName:
              contactName,
          });
      } catch (error: unknown) {
        if (
          error &&
          typeof error ===
            "object" &&
          "code" in error &&
          Number(
            (
              error as {
                code?: unknown;
              }
            ).code
          ) ===
            11000
        ) {
          return NextResponse.json<ApiResponse>(
            {
              success: false,
              error:
                "A Message Request already exists between these accounts.",
            },
            {
              status: 409,
            }
          );
        }

        throw error;
      }
    }

    await Notification.deleteMany({
      userId:
        targetUser._id,

      type:
        "chat_request",

      chatRequestId:
        chatRequest._id,
    });

    const senderName =
      `${currentUser.firstName ?? ""} ${
        currentUser.lastName ?? ""
      }`.trim() ||
      "A user";

    const notificationTitle =
      "New Message Request";

    const notificationMessage =
      `${senderName} wants to connect with you through Chat.`;

    await Notification.create({
      userId:
        targetUser._id,

      type:
        "chat_request",

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

      read:
        false,
    });

    await sendChatRequestPush(
      targetUser._id.toString(),

      targetUser
        .notificationPreferences
        ?.push !== false,

      {
        title:
          notificationTitle,

        body:
          notificationMessage,

        type:
          "chat_request",

        screen:
          "chats",

        url:
          "/chats",

        requestId:
          chatRequest._id.toString(),

        chatRequestId:
          chatRequest._id.toString(),
      }
    );

    return NextResponse.json<ApiResponse>(
      {
        success: true,

        data: {
          requestId:
            chatRequest._id.toString(),

          status:
            chatRequest.status,
        },

        message:
          "Message Request sent. Chat will be available after the recipient accepts.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "[POST /api/chats]",
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