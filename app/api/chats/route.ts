import {
  NextRequest,
  NextResponse,
} from "next/server";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import User from "@/models/User";
import MonitoringRequest from "@/models/MonitoringRequest";
import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";
import type { ApiResponse } from "@/lib/interfaces/data/Api";
import type { ConversationSummary } from "@/lib/interfaces/data/Chat";
import {
  ensureApprovedConversation,
  getApprovedConversationIdsForUser,
} from "@/lib/monitoringAuthorization";

const TYPING_TTL_MS = 6000;

async function getAuthUser(
  request: NextRequest
) {
  const token =
    getTokenFromRequest(request);

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export async function GET(
  request: NextRequest
) {
  try {
    const auth =
      await getAuthUser(request);

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

    const approvedConversationIds =
      await getApprovedConversationIdsForUser(
        auth.userId
      );

    const conversations =
      await Conversation.find({
        _id: {
          $in: approvedConversationIds,
        },
      })
        .sort({
          lastMessageAt: -1,
          updatedAt: -1,
        })
        .populate(
          "participants",
          "firstName lastName patientId role"
        )
        .lean();

    const now = Date.now();

    const summaries:
      ConversationSummary[] =
      await Promise.all(
        conversations.map(
          async (conversation) => {
            type PopulatedUser = {
              _id: {
                toString(): string;
              };
              firstName?: string;
              lastName?: string;
              patientId?: string;
              role?:
                | "patient"
                | "family";
            };

            const participants =
              conversation.participants as unknown as PopulatedUser[];

            const other =
              participants.find(
                (participant) =>
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

            const fallbackName = other
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
                    $ne: "read",
                  },
                }
              );

            let isTyping = false;

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
                typingMap instanceof Map
                  ? typingMap.get(
                      otherId
                    )
                  : typingMap?.[
                      otherId
                    ];

              if (rawTimestamp) {
                const timestamp =
                  new Date(
                    rawTimestamp
                  ).getTime();

                isTyping =
                  now - timestamp <
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

                patientId:
                  other?.patientId ??
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
      summaries.map((summary) => ({
        ...summary,
        updatedAt: new Date(
          summary.updatedAt
        ).toISOString(),
      }));

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

// A Patient enters a Family ID.
// This Patient-initiated action is the
// explicit authorization for monitoring
// and chat access.
export async function POST(
  request: NextRequest
) {
  try {
    const auth =
      await getAuthUser(request);

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
      await request.json();

    const familyId =
      typeof body.familyId ===
      "string"
        ? body.familyId
            .trim()
            .toUpperCase()
        : "";

    const contactName =
      typeof body.contactName ===
      "string"
        ? body.contactName.trim()
        : "";

    if (!familyId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Family ID is required",
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
        "role patientId firstName lastName"
      );

    if (!currentUser) {
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

    if (
      currentUser.role !==
      "patient"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Only Patient accounts can invite a Family member by Family ID.",
        },
        {
          status: 403,
        }
      );
    }

    const targetUser =
      await User.findOne({
        familyId,
        role: "family",
        isDeleted: {
          $ne: true,
        },
      }).select(
        "_id firstName lastName familyId role"
      );

    if (!targetUser) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "No Family account was found with this ID.",
        },
        {
          status: 404,
        }
      );
    }

    await MonitoringRequest.findOneAndUpdate(
      {
        patientId:
          currentUser._id,
        familyId:
          targetUser._id,
      },
      {
        $set: {
          status: "approved",
          respondedAt:
            new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    const conversation =
      await ensureApprovedConversation(
        currentUser._id.toString(),
        targetUser._id.toString()
      );

    const defaultName =
      `${targetUser.firstName ?? ""} ${
        targetUser.lastName ?? ""
      }`.trim() ||
      "Family member";

    conversation.contactNames.set(
      auth.userId,
      contactName || defaultName
    );

    await conversation.save();

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          conversationId:
            conversation._id.toString(),

          contact: {
            userId:
              targetUser._id.toString(),

            name:
              contactName ||
              defaultName,

            patientId: "",

            role:
              targetUser.role,

            avatarUrl: null,
          },
        },

        message:
          "Family member connected. Monitoring access and chat are now available.",
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