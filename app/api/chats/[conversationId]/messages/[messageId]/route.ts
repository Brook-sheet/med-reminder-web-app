// app/api/chats/[conversationId]/messages/[messageId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import Attachment from '@/models/Attachment';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { serializeMessageForUser, buildReplyPreview } from '@/lib/chatSerializers';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

function previewForMessage(m: { type: 'text' | 'attachment'; text: string; attachment: { mimeType: string; fileName: string } | null }) {
  if (m.type === 'attachment' && m.attachment) {
    return m.attachment.mimeType.startsWith('image/') ? '📷 Photo' : `📎 ${m.attachment.fileName}`;
  }
  return m.text;
}

// ── DELETE /api/chats/[conversationId]/messages/[messageId] ───────────────
// Message-level "unsend" — a SEPARATE feature from conversation/contact
// removal (DELETE /api/chats/[conversationId]). This endpoint never touches
// Conversation.deletedFor or deletes the conversation itself.
//
// Body: { scope: 'me' | 'everyone' }
//   'me'       — hides this one message from the requesting user only.
//                Persisted on the message itself (deletedFor), independent
//                of the other participant's copy.
//   'everyone' — replaces the message with a tombstone for BOTH
//                participants. Only the ORIGINAL SENDER may do this —
//                enforced here server-side regardless of what the client
//                requests, since the client-side menu only ever offers this
//                option on the user's own messages.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> }
) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId, messageId } = await params;
    if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const scope = body.scope;
    if (scope !== 'me' && scope !== 'everyone') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'scope must be "me" or "everyone"' },
        { status: 400 }
      );
    }

    await connectDB();

    // Must be a participant of the conversation to touch anything in it —
    // same authorization boundary used everywhere else in the chats API.
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: auth.userId,
    });
    if (!conversation) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conversation not found' }, { status: 404 });
    }

    const message = await Message.findOne({ _id: messageId, conversationId });
    if (!message) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Message not found' }, { status: 404 });
    }

    // ── Unsend for you ───────────────────────────────────────────────────
    if (scope === 'me') {
      if (!message.deletedFor.some((id) => id.toString() === auth.userId)) {
        message.deletedFor.push(new mongoose.Types.ObjectId(auth.userId));
        await message.save();
      }
      return NextResponse.json<ApiResponse>({
        success: true,
        message: 'Message unsent for you',
        data: { messageId: message._id.toString(), scope: 'me' },
      });
    }

    // ── Unsend for everyone ─────────────────────────────────────────────
    if (message.senderId.toString() !== auth.userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the sender can unsend this message for everyone' },
        { status: 403 }
      );
    }

    if (!message.unsentForEveryone) {
      message.unsentForEveryone = true;
      message.text = '';
      if (message.attachment) {
        // Actually remove the underlying file — unsending for everyone
        // should revoke access for both participants, not just hide the
        // reference to it while the file stays downloadable by ID.
        await Attachment.deleteOne({ _id: message.attachment.attachmentId });
        message.attachment = null;
      }
      await message.save();

      // Keep the Chats List preview in sync if this was the most recent
      // message — otherwise the list would keep showing text that no
      // longer exists after a refresh.
      const wasLastMessage =
        conversation.lastMessageAt &&
        conversation.lastMessageSenderId?.toString() === message.senderId.toString() &&
        Math.abs(conversation.lastMessageAt.getTime() - message.createdAt.getTime()) < 1000;

      if (wasLastMessage) {
        const latestVisible = await Message.findOne({
          conversationId: conversation._id,
          unsentForEveryone: { $ne: true },
        }).sort({ createdAt: -1 });

        conversation.lastMessageText = latestVisible ? previewForMessage(latestVisible) : null;
        conversation.lastMessageAt = latestVisible ? latestVisible.createdAt : null;
        conversation.lastMessageSenderId = latestVisible ? latestVisible.senderId : null;
        await conversation.save();
      }
    }

    // If this message was itself a reply, keep that context visible on its
    // tombstone too (resolved fresh here since the DELETE handler above
    // doesn't otherwise touch reply data).
    let replyPreview = null;
    if (message.replyToMessageId) {
      const ref = await Message.findById(message.replyToMessageId);
      if (ref) replyPreview = buildReplyPreview(ref);
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Message unsent for everyone',
      data: {
        messageId: message._id.toString(),
        scope: 'everyone',
        updatedMessage: serializeMessageForUser(message, auth.userId, replyPreview),
      },
    });
  } catch (error) {
    console.error('[DELETE /api/chats/[conversationId]/messages/[messageId]]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}