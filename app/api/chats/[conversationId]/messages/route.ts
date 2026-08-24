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
  buildReplyPreview,
  serializeMessageForUser,
} from "@/lib/chatSerializers";

import type {
  SerializedChatMessage,
  SerializedReplyPreview,
} from "@/lib/chatSerializers";

import type {
  ApiResponse,
} from "@/lib/interfaces/data/Api";

import {
  connectDB,
} from "@/lib/mongodb";

import {
  sendWebPushToUser,
} from "@/lib/notificationChannels";

import Attachment, {
  MAX_ATTACHMENT_BYTES,
} from "@/models/Attachment";

import Conversation from "@/models/Conversation";

import type {
  IConversationDocument,
} from "@/models/Conversation";

import Message from "@/models/Message";

import type {
  IMessageDocument,
} from "@/models/Message";

import Notification from "@/models/Notification";
import User from "@/models/User";

const TYPING_TTL_MS =
  6000;

const MAX_CAPTION_LENGTH =
  4000;

const BLOCKED_EXTENSIONS =
  new Set([
    "exe",
    "msi",
    "bat",
    "cmd",
    "com",
    "scr",
    "sh",
    "bash",
    "ps1",
    "js",
    "jse",
    "vbs",
    "vbe",
    "wsf",
    "wsh",
    "jar",
    "apk",
    "dll",
  ]);

interface ChatNotificationUser {
  _id:
    mongoose.Types.ObjectId;

  firstName?:
    string;

  lastName?:
    string;

  isDeleted?:
    boolean;

  notificationPreferences?: {
    inApp?: boolean;
    push?: boolean;
    sms?: boolean;
  };
}

function getExtension(
  fileName: string
): string {
  const index =
    fileName.lastIndexOf(
      "."
    );

  return index ===
    -1
    ? ""
    : fileName
        .slice(
          index + 1
        )
        .toLowerCase();
}

function getUserName(
  user:
    | ChatNotificationUser
    | null
): string {
  if (!user) {
    return "A contact";
  }

  return (
    `${user.firstName ?? ""} ${
      user.lastName ?? ""
    }`.trim() ||
    "A contact"
  );
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

async function loadConversation(
  conversationId: string,
  userId: string
) {
  if (
    !mongoose.Types.ObjectId.isValid(
      conversationId
    )
  ) {
    return null;
  }

  return Conversation.findOne({
    _id:
      conversationId,

    participants:
      userId,

    deletedFor: {
      $size: 0,
    },
  });
}

async function resolveReplyTarget(
  conversationId:
    mongoose.Types.ObjectId,

  rawId:
    unknown
): Promise<{
  id?:
    mongoose.Types.ObjectId;

  preview:
    SerializedReplyPreview | null;

  error?:
    string;
}> {
  if (
    rawId ===
      undefined ||
    rawId ===
      null ||
    rawId ===
      ""
  ) {
    return {
      preview:
        null,
    };
  }

  if (
    typeof rawId !==
      "string" ||
    !mongoose.Types.ObjectId.isValid(
      rawId
    )
  ) {
    return {
      preview:
        null,

      error:
        "Invalid message to reply to",
    };
  }

  const referencedMessage =
    await Message.findOne({
      _id:
        rawId,

      conversationId,
    });

  if (
    !referencedMessage
  ) {
    return {
      preview:
        null,

      error:
        "The message you are replying to could not be found",
    };
  }

  return {
    id:
      referencedMessage._id,

    preview:
      buildReplyPreview(
        referencedMessage
      ),
  };
}

async function applyConversationSideEffects(
  conversation:
    IConversationDocument,

  senderId:
    string,

  previewText:
    string,

  createdAt:
    Date
) {
  conversation.lastMessageText =
    previewText;

  conversation.lastMessageAt =
    createdAt;

  conversation.lastMessageSenderId =
    new mongoose.Types.ObjectId(
      senderId
    );

  conversation.typing.delete(
    senderId
  );

  await conversation.save();
}

async function notifyChatRecipient(params: {
  senderId:
    string;

  recipientId:
    mongoose.Types.ObjectId;

  conversationId:
    mongoose.Types.ObjectId;

  messageId:
    mongoose.Types.ObjectId;

  attachment:
    boolean;
}): Promise<void> {
  try {
    const [
      rawSender,
      rawRecipient,
    ] =
      await Promise.all([
        User.findById(
          params.senderId
        )
          .select(
            "_id firstName lastName isDeleted"
          )
          .lean(),

        User.findById(
          params.recipientId
        )
          .select(
            "_id notificationPreferences isDeleted"
          )
          .lean(),
      ]);

    const sender =
      rawSender as unknown as
        | ChatNotificationUser
        | null;

    const recipient =
      rawRecipient as unknown as
        | ChatNotificationUser
        | null;

    if (
      !recipient ||
      recipient.isDeleted
    ) {
      return;
    }

    const senderName =
      getUserName(
        sender
      );

    const notificationTitle =
      `New message from ${senderName}`;

    /*
     * Do not display private message contents on the
     * device lock screen.
     */
    const notificationMessage =
      params.attachment
        ? "You received a new attachment."
        : "You received a new message.";

    await Notification.create({
      userId:
        params.recipientId,

      type:
        "chat_message",

      title:
        notificationTitle,

      message:
        notificationMessage,

      screen:
        "chats",

      url:
        "/chats",

      conversationId:
        params.conversationId,

      messageId:
        params.messageId,

      read:
        false,
    });

    if (
      recipient
        .notificationPreferences
        ?.push === false
    ) {
      return;
    }

    const delivery =
      await sendWebPushToUser(
        params.recipientId.toString(),

        {
          title:
            notificationTitle,

          body:
            notificationMessage,

          type:
            "chat_message",

          screen:
            "chats",

          url:
            "/chats",

          conversationId:
            params.conversationId.toString(),

          messageId:
            params.messageId.toString(),
        }
      );

    if (
      delivery.status ===
      "FAILED"
    ) {
      console.warn(
        "[Chat Message Push] Delivery failed:",
        delivery.error
      );
    }
  } catch (error) {
    /*
     * Notification failure must not cause the client to
     * retry an already-created message.
     */
    console.warn(
      "[Chat Message Push] Unexpected notification error:",
      error
    );
  }
}

export async function GET(
  request: NextRequest,

  {
    params,
  }: {
    params: Promise<{
      conversationId:
        string;
    }>;
  }
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

    const {
      conversationId,
    } =
      await params;

    await connectDB();

    const conversation =
      await loadConversation(
        conversationId,
        auth.userId
      );

    if (!conversation) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Conversation not found",
        },
        {
          status: 404,
        }
      );
    }

    const {
      searchParams,
    } =
      new URL(
        request.url
      );

    const since =
      searchParams.get(
        "since"
      );

    const markRead =
      searchParams.get(
        "markRead"
      ) ===
      "1";

    await Message.updateMany(
      {
        conversationId,

        recipientId:
          auth.userId,

        status:
          "sent",
      },
      {
        $set: {
          status:
            "delivered",
        },
      }
    );

    if (markRead) {
      await Promise.all([
        Message.updateMany(
          {
            conversationId,

            recipientId:
              auth.userId,

            status: {
              $ne:
                "read",
            },
          },
          {
            $set: {
              status:
                "read",
            },
          }
        ),

        Notification.updateMany(
          {
            userId:
              auth.userId,

            conversationId:
              conversation._id,

            type:
              "chat_message",

            read:
              false,
          },
          {
            $set: {
              read:
                true,
            },
          }
        ),
      ]);

      conversation.typing.delete(
        auth.userId
      );

      await conversation.save();
    }

    const query:
      Record<
        string,
        unknown
      > = {
      conversationId,
    };

    if (since) {
      const sinceDate =
        new Date(
          since
        );

      if (
        !Number.isNaN(
          sinceDate.getTime()
        )
      ) {
        query.updatedAt = {
          $gt:
            sinceDate,
        };
      }
    }

    const messages =
      await Message.find(
        query
      )
        .sort({
          createdAt: 1,
        })
        .limit(
          since
            ? 200
            : 100
        );

    const trimmed =
      since
        ? messages
        : messages.slice(
            -100
          );

    const replyIds =
      Array.from(
        new Set(
          trimmed
            .filter(
              (
                message
              ) =>
                message.replyToMessageId
            )
            .map(
              (
                message
              ) =>
                message.replyToMessageId!.toString()
            )
        )
      );

    const replyReferenceMap =
      new Map<
        string,
        IMessageDocument
      >();

    if (
      replyIds.length >
      0
    ) {
      const references =
        await Message.find({
          _id: {
            $in:
              replyIds,
          },
        });

      for (
        const reference of
        references
      ) {
        replyReferenceMap.set(
          reference._id.toString(),
          reference
        );
      }
    }

    const otherId =
      conversation.participants
        .find(
          (
            participant
          ) =>
            participant.toString() !==
            auth.userId
        )
        ?.toString();

    let otherIsTyping =
      false;

    if (otherId) {
      const timestamp =
        conversation.typing.get(
          otherId
        );

      if (timestamp) {
        otherIsTyping =
          Date.now() -
            new Date(
              timestamp
            ).getTime() <
          TYPING_TTL_MS;
      }
    }

    const serialized =
      trimmed
        .map(
          (
            message
          ) => {
            let replyPreview:
              SerializedReplyPreview | null =
              null;

            if (
              message.replyToMessageId
            ) {
              const reference =
                replyReferenceMap.get(
                  message.replyToMessageId.toString()
                );

              if (reference) {
                replyPreview =
                  buildReplyPreview(
                    reference
                  );
              }
            }

            return serializeMessageForUser(
              message,
              auth.userId,
              replyPreview
            );
          }
        )
        .filter(
          (
            message
          ): message is SerializedChatMessage =>
            message !==
            null
        );

    return NextResponse.json<ApiResponse>({
      success: true,

      data: {
        messages:
          serialized,

        otherIsTyping,

        serverTime:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/chats/[conversationId]/messages]",
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
  request: NextRequest,

  {
    params,
  }: {
    params: Promise<{
      conversationId:
        string;
    }>;
  }
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

    const {
      conversationId,
    } =
      await params;

    await connectDB();

    const conversation =
      await loadConversation(
        conversationId,
        auth.userId
      );

    if (!conversation) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Conversation not found",
        },
        {
          status: 404,
        }
      );
    }

    const recipientId =
      conversation.participants.find(
        (
          participant
        ) =>
          participant.toString() !==
          auth.userId
      );

    if (!recipientId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Conversation is missing a recipient",
        },
        {
          status: 500,
        }
      );
    }

    const contentType =
      request.headers.get(
        "content-type"
      ) ||
      "";

    if (
      contentType.includes(
        "multipart/form-data"
      )
    ) {
      const formData =
        await request.formData();

      const file =
        formData.get(
          "file"
        );

      const captionRaw =
        formData.get(
          "caption"
        );

      const caption =
        typeof captionRaw ===
        "string"
          ? captionRaw
              .trim()
              .slice(
                0,
                MAX_CAPTION_LENGTH
              )
          : "";

      const replyToRaw =
        formData.get(
          "replyToMessageId"
        );

      if (
        !(file instanceof File)
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              "No file was provided",
          },
          {
            status: 400,
          }
        );
      }

      if (
        file.size <=
        0
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              "This file appears to be empty",
          },
          {
            status: 400,
          }
        );
      }

      if (
        file.size >
        MAX_ATTACHMENT_BYTES
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,

            error:
              `File is too large. The maximum size is ${
                MAX_ATTACHMENT_BYTES /
                (
                  1024 *
                  1024
                )
              }MB.`,
          },
          {
            status: 400,
          }
        );
      }

      const extension =
        getExtension(
          file.name ||
          ""
        );

      if (
        BLOCKED_EXTENSIONS.has(
          extension
        )
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              "This file type is not allowed for security reasons",
          },
          {
            status: 400,
          }
        );
      }

      const replyTarget =
        await resolveReplyTarget(
          conversation._id,
          replyToRaw
        );

      if (
        replyTarget.error
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              replyTarget.error,
          },
          {
            status: 400,
          }
        );
      }

      const arrayBuffer =
        await file.arrayBuffer();

      const buffer =
        Buffer.from(
          arrayBuffer
        );

      const fileName =
        (
          file.name ||
          "attachment"
        ).slice(
          0,
          255
        );

      const mimeType =
        (
          file.type ||
          "application/octet-stream"
        ).slice(
          0,
          127
        );

      const attachmentDocument =
        await Attachment.create({
          conversationId:
            conversation._id,

          uploaderId:
            auth.userId,

          fileName,
          mimeType,

          fileSize:
            file.size,

          data:
            buffer,
        });

      const message =
        await Message.create({
          conversationId:
            conversation._id,

          senderId:
            auth.userId,

          recipientId,

          type:
            "attachment",

          text:
            caption,

          attachment: {
            attachmentId:
              attachmentDocument._id,

            fileName,
            mimeType,

            fileSize:
              file.size,
          },

          status:
            "sent",

          replyToMessageId:
            replyTarget.id ??
            null,
        });

      const preview =
        mimeType.startsWith(
          "image/"
        )
          ? "📷 Photo"
          : `📎 ${fileName}`;

      await applyConversationSideEffects(
        conversation,
        auth.userId,
        preview,
        message.createdAt
      );

      await notifyChatRecipient({
        senderId:
          auth.userId,

        recipientId,

        conversationId:
          conversation._id,

        messageId:
          message._id,

        attachment:
          true,
      });

      return NextResponse.json<ApiResponse>(
        {
          success: true,

          data:
            serializeMessageForUser(
              message,
              auth.userId,
              replyTarget.preview
            )!,
        },
        {
          status: 201,
        }
      );
    }

    const body =
      await request.json();

    const text =
      typeof body.text ===
      "string"
        ? body.text.trim()
        : "";

    if (!text) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Message text is required",
        },
        {
          status: 400,
        }
      );
    }

    if (
      text.length >
      MAX_CAPTION_LENGTH
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Message is too long",
        },
        {
          status: 400,
        }
      );
    }

    const replyTarget =
      await resolveReplyTarget(
        conversation._id,
        body.replyToMessageId
      );

    if (
      replyTarget.error
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            replyTarget.error,
        },
        {
          status: 400,
        }
      );
    }

    const message =
      await Message.create({
        conversationId:
          conversation._id,

        senderId:
          auth.userId,

        recipientId,

        type:
          "text",

        text,

        status:
          "sent",

        replyToMessageId:
          replyTarget.id ??
          null,
      });

    await applyConversationSideEffects(
      conversation,
      auth.userId,
      text,
      message.createdAt
    );

    await notifyChatRecipient({
      senderId:
        auth.userId,

      recipientId,

      conversationId:
        conversation._id,

      messageId:
        message._id,

      attachment:
        false,
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,

        data:
          serializeMessageForUser(
            message,
            auth.userId,
            replyTarget.preview
          )!,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "[POST /api/chats/[conversationId]/messages]",
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