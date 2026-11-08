import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import {
  getTokenFromRequest,
  verifyToken,
} from '@/lib/auth';

import { connectDB } from '@/lib/mongodb';

import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import Notification from '@/models/Notification';
import User from '@/models/User';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function snapshot(userId: string) {
  /*
   * Chat access follows the existing chat relationship.
   * Only active conversations belonging to this user qualify.
   */
  const conversations = await Conversation.find({
    participants: userId,
    deletedFor: { $size: 0 },
  })
    .select('_id')
    .lean();

  const conversationIds = conversations.map(
    (item) => item._id,
  );

  const filter = {
    userId,
    type: 'chat_message' as const,
    conversationId: { $in: conversationIds },
    messageId: { $type: 'objectId' as const },
  };

  /*
   * Reuse notifications created by the existing message
   * handler. This endpoint never creates notifications.
   */
  const [saved, unreadIds] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .lean(),

    Notification.distinct('messageId', {
      ...filter,
      read: false,
    }),
  ]);

  const messageIds = [
    ...saved.map((item) => item.messageId),
    ...unreadIds,
  ].filter(
    (id): id is mongoose.Types.ObjectId =>
      id != null,
  );

  const messages = await Message.find({
    _id: { $in: messageIds },
    recipientId: userId,
    conversationId: { $in: conversationIds },
    deletedFor: { $ne: userId },
  })
    .select(
      '_id conversationId senderId text type attachment status unsentForEveryone',
    )
    .lean();

  const messageById = new Map(
    messages.map((item) => [
      item._id.toString(),
      item,
    ]),
  );

  const senders = await User.find({
    _id: {
      $in: messages.map(
        (item) => item.senderId,
      ),
    },
  })
    .select('_id firstName lastName')
    .lean();

  const names = new Map(
    senders.map((item) => [
      item._id.toString(),
      `${item.firstName ?? ''} ${
        item.lastName ?? ''
      }`.trim() || 'A contact',
    ]),
  );

  const seen = new Set<string>();
  const notifications = [];

  for (const item of saved) {
    const messageId =
      item.messageId?.toString();

    const message = messageId
      ? messageById.get(messageId)
      : null;

    if (
      !message ||
      !messageId ||
      seen.has(messageId)
    ) {
      continue;
    }

    if (
      message.conversationId.toString() !==
      item.conversationId?.toString()
    ) {
      continue;
    }

    /*
     * One displayed notification per actual message,
     * even if legacy duplicate notification records exist.
     */
    seen.add(messageId);

    const sender =
      names.get(
        message.senderId.toString(),
      ) ?? 'A contact';

    const preview = message.unsentForEveryone
      ? 'This message was unsent.'
      : message.text.trim() ||
        (
          message.type === 'attachment'
            ? message.attachment?.mimeType.startsWith(
                'image/',
              )
              ? 'Photo'
              : `Attachment: ${
                  message.attachment?.fileName ??
                  'File'
                }`
            : 'New message'
        );

    notifications.push({
      _id: item._id.toString(),

      conversationId:
        message.conversationId.toString(),

      messageId,

      title:
        `New message from ${sender}`,

      message:
        preview
          .replace(/\s+/g, ' ')
          .slice(0, 140),

      /*
       * The existing conversation handler marks both
       * messages and chat notifications as read.
       *
       * Checking the actual message also handles a
       * notification saved just after a read request.
       */
      read:
        item.read ||
        message.status === 'read' ||
        message.unsentForEveryone,

      createdAt:
        new Date(
          item.createdAt,
        ).toISOString(),
    });
  }

  const unreadCount = new Set(
    unreadIds
      .filter((id) => {
        const message =
          messageById.get(String(id));

        return (
          message &&
          message.status !== 'read' &&
          !message.unsentForEveryone
        );
      })
      .map(String),
  ).size;

  return {
    notifications,
    unreadCount,
  };
}

export async function GET(
  request: NextRequest,
) {
  const token =
    getTokenFromRequest(request);

  const auth = token
    ? await verifyToken(token)
    : null;

  if (
    !auth ||
    auth.role !== 'family'
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'Access denied.',
      },
      { status: 403 },
    );
  }

  try {
    await connectDB();

    /*
     * JSON is used for fallback refreshes and
     * refreshing after "Mark all read".
     */
    if (
      request.nextUrl.searchParams.get(
        'stream',
      ) !== '1'
    ) {
      return NextResponse.json(
        {
          success: true,
          data: await snapshot(
            auth.userId,
          ),
        },
        {
          headers: {
            'Cache-Control':
              'private, no-store',
          },
        },
      );
    }

    let stop = () => {};

    const stream =
      new ReadableStream<Uint8Array>({
        start(controller) {
          let closed = false;
          let busy = false;
          let previous = '';

          const encoder =
            new TextEncoder();

          const emit = (
            event: string,
            data: unknown,
          ) => {
            if (!closed) {
              controller.enqueue(
                encoder.encode(
                  `event: ${event}\ndata: ${
                    JSON.stringify(data)
                  }\n\n`,
                ),
              );
            }
          };

          const poll = async () => {
            if (closed || busy) {
              return;
            }

            busy = true;

            try {
              const data =
                await snapshot(
                  auth.userId,
                );

              const signature =
                JSON.stringify(data);

              /*
               * Send a replacement snapshot only
               * when the displayed data changes.
               */
              if (
                !closed &&
                signature !== previous
              ) {
                emit('snapshot', data);
                previous = signature;
              }
            } catch (error) {
              console.error(
                '[Chat notification stream]',
                error,
              );

              emit('server-error', {
                message:
                  'Unable to refresh chat notifications.',
              });
            } finally {
              busy = false;
            }
          };

          const timer = setInterval(
            () => void poll(),
            2_000,
          );

          const heartbeat =
            setInterval(
              () =>
                emit('heartbeat', {}),
              15_000,
            );

          /*
           * Reconnect periodically instead of keeping
           * one server request open indefinitely.
           * Reconnection sends a fresh snapshot.
           */
          const maximum = setTimeout(
            () => stop(),
            25_000,
          );

          stop = () => {
            if (closed) {
              return;
            }

            closed = true;

            clearInterval(timer);
            clearInterval(heartbeat);
            clearTimeout(maximum);

            request.signal.removeEventListener(
              'abort',
              stop,
            );

            try {
              controller.close();
            } catch {
              // Already disconnected.
            }
          };

          request.signal.addEventListener(
            'abort',
            stop,
            { once: true },
          );

          if (
            request.signal.aborted
          ) {
            stop();
            return;
          }

          emit('connected', {});
          void poll();
        },

        cancel() {
          stop();
        },
      });

    return new Response(stream, {
      headers: {
        'Content-Type':
          'text/event-stream',

        'Cache-Control':
          'private, no-cache, no-transform',

        'X-Accel-Buffering':
          'no',
      },
    });
  } catch (error) {
    console.error(
      '[Chat notifications]',
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          'Unable to load chat notifications.',
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
) {
  const token =
    getTokenFromRequest(request);

  const auth = token
    ? await verifyToken(token)
    : null;

  if (
    !auth ||
    auth.role !== 'family'
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'Access denied.',
      },
      { status: 403 },
    );
  }

  const body =
    await request
      .json()
      .catch(() => ({}));

  if (
    body.action !== 'markAllRead'
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action.',
      },
      { status: 400 },
    );
  }

  try {
    await connectDB();

    /*
     * Mark notification entries read only.
     * Message read receipts continue to be handled
     * when the conversation is viewed.
     */
    await Notification.updateMany(
      {
        userId:
          new mongoose.Types.ObjectId(
            auth.userId,
          ),

        type:
          'chat_message' as const,

        read:
          false,
      },
      {
        $set: {
          read: true,
        },
      },
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      '[Chat notifications read]',
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          'Unable to mark chat notifications read.',
      },
      { status: 500 },
    );
  }
}