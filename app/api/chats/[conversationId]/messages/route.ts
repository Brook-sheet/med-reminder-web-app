// app/api/chats/[conversationId]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import Conversation, { IConversationDocument } from '@/models/Conversation';
import Message, { IMessageDocument } from '@/models/Message';
import Attachment, { MAX_ATTACHMENT_BYTES } from '@/models/Attachment';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import {
  serializeMessageForUser,
  buildReplyPreview,
  type SerializedChatMessage,
  type SerializedReplyPreview,
} from '@/lib/chatSerializers';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

const TYPING_TTL_MS = 6000;
const MAX_CAPTION_LENGTH = 4000;

// Mirrors the client-side list in lib/chatMedia.ts — this is the
// authoritative server-side check; the client check is just a fast-fail UX
// nicety and must never be the only line of defense.
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'sh', 'bash', 'ps1',
  'js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'jar', 'apk', 'dll',
]);

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx + 1).toLowerCase();
}

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

async function loadConversation(conversationId: string, userId: string) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) return null;
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });
  return conversation;
}

// Validates an optional "reply to" reference sent by the client. Returns the
// resolved ObjectId to store on the new message plus its preview for the
// immediate response — or an `error` string if the client supplied a value
// that doesn't check out (invalid id, or a message from a different
// conversation, which would let one conversation's messages leak a preview
// into another).
async function resolveReplyTarget(
  conversationId: mongoose.Types.ObjectId,
  rawId: unknown
): Promise<{ id?: mongoose.Types.ObjectId; preview: SerializedReplyPreview | null; error?: string }> {
  if (rawId === undefined || rawId === null || rawId === '') {
    return { preview: null };
  }
  if (typeof rawId !== 'string' || !mongoose.Types.ObjectId.isValid(rawId)) {
    return { preview: null, error: 'Invalid message to reply to' };
  }
  const ref = await Message.findOne({ _id: rawId, conversationId });
  if (!ref) {
    return { preview: null, error: 'The message you are replying to could not be found' };
  }
  return { id: ref._id, preview: buildReplyPreview(ref) };
}

// Applies the bookkeeping shared by every new message (text or attachment):
// bump the conversation preview, clear the sender's typing flag, and revive
// the conversation for a recipient who had previously removed it.
async function applyConversationSideEffects(
  conversation: IConversationDocument,
  senderId: string,
  recipientId: mongoose.Types.ObjectId,
  previewText: string,
  createdAt: Date
) {
  conversation.lastMessageText = previewText;
  conversation.lastMessageAt = createdAt;
  conversation.lastMessageSenderId = new mongoose.Types.ObjectId(senderId);
  conversation.typing.delete(senderId);
  conversation.deletedFor = conversation.deletedFor.filter((id) => id.toString() !== recipientId.toString());
  await conversation.save();
}

// ── GET /api/chats/[conversationId]/messages ───────────────────────────────
// Query params:
//   since   - ISO timestamp; only return messages created after this time
//   markRead - '1' if the user currently has this conversation open/focused,
//              which promotes any unread incoming messages straight to "read"
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;
    await connectDB();

    const conversation = await loadConversation(conversationId, auth.userId);
    if (!conversation) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conversation not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    const markRead = searchParams.get('markRead') === '1';

    // Mark incoming messages as at least "delivered" the moment this user polls
    await Message.updateMany(
      { conversationId, recipientId: auth.userId, status: 'sent' },
      { $set: { status: 'delivered' } }
    );

    // If the user is actively viewing this conversation, promote to "read"
    if (markRead) {
      await Message.updateMany(
        { conversationId, recipientId: auth.userId, status: { $ne: 'read' } },
        { $set: { status: 'read' } }
      );
      // Clear this user's typing flag once they're actively reading
      conversation.typing.delete(auth.userId);
      await conversation.save();
    }

    const query: Record<string, unknown> = { conversationId };
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        // Filtered by updatedAt rather than createdAt: an "unsend" (or a
        // delivered/read status change) touches an EXISTING message rather
        // than creating a new one, so it only bumps updatedAt. Filtering by
        // createdAt would mean a message that already scrolled past the
        // `since` cutoff could never be re-fetched again after it's edited —
        // the other participant's poll would just never see the unsend.
        query.updatedAt = { $gt: sinceDate };
      }
    }

    const messages = await Message.find(query).sort({ createdAt: 1 }).limit(since ? 200 : 100);

    // If no `since` was passed, only return the most recent 100, still oldest→newest
    const trimmed = since ? messages : messages.slice(-100);

    // Batch-resolve reply previews in a single query rather than one lookup
    // per message — this is a live lookup (not a stored snapshot), so a
    // reply's quoted preview always reflects the referenced message's
    // current state, including a later "unsend".
    const replyIds = Array.from(
      new Set(trimmed.filter((m) => m.replyToMessageId).map((m) => m.replyToMessageId!.toString()))
    );
    const replyRefMap = new Map<string, IMessageDocument>();
    if (replyIds.length > 0) {
      const refs = await Message.find({ _id: { $in: replyIds } });
      for (const ref of refs) replyRefMap.set(ref._id.toString(), ref);
    }

    const otherId = conversation.participants.find((p) => p.toString() !== auth.userId)?.toString();
    let otherIsTyping = false;
    if (otherId) {
      const ts = conversation.typing.get(otherId);
      if (ts) otherIsTyping = Date.now() - new Date(ts).getTime() < TYPING_TTL_MS;
    }

    const serialized = trimmed
      .map((m) => {
        let replyPreview: SerializedReplyPreview | null = null;
        if (m.replyToMessageId) {
          const ref = replyRefMap.get(m.replyToMessageId.toString());
          if (ref) replyPreview = buildReplyPreview(ref);
        }
        return serializeMessageForUser(m, auth.userId, replyPreview);
      })
      .filter((m): m is SerializedChatMessage => m !== null);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        messages: serialized,
        otherIsTyping,
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/chats/[conversationId]/messages]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST /api/chats/[conversationId]/messages — send a new message ────────
// Accepts either:
//   - application/json     { text: string, replyToMessageId?: string }
//   - multipart/form-data  { file: File, caption?: string, replyToMessageId?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;
    await connectDB();

    const conversation = await loadConversation(conversationId, auth.userId);
    if (!conversation) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conversation not found' }, { status: 404 });
    }

    const recipientId = conversation.participants.find((p) => p.toString() !== auth.userId);
    if (!recipientId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conversation is missing a recipient' }, { status: 500 });
    }

    const contentType = request.headers.get('content-type') || '';

    // ── Attachment (image/file) message ──────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const captionRaw = formData.get('caption');
      const caption = typeof captionRaw === 'string' ? captionRaw.trim().slice(0, MAX_CAPTION_LENGTH) : '';
      const replyToRaw = formData.get('replyToMessageId');

      if (!(file instanceof File)) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'No file was provided' }, { status: 400 });
      }
      if (file.size <= 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'This file appears to be empty' }, { status: 400 });
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `File is too large. The maximum size is ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB.` },
          { status: 400 }
        );
      }
      const ext = getExtension(file.name || '');
      if (BLOCKED_EXTENSIONS.has(ext)) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'This file type is not allowed for security reasons' }, { status: 400 });
      }

      const replyTarget = await resolveReplyTarget(conversation._id, replyToRaw);
      if (replyTarget.error) {
        return NextResponse.json<ApiResponse>({ success: false, error: replyTarget.error }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = (file.name || 'attachment').slice(0, 255);
      const mimeType = (file.type || 'application/octet-stream').slice(0, 127);

      const attachmentDoc = await Attachment.create({
        conversationId: conversation._id,
        uploaderId: auth.userId,
        fileName,
        mimeType,
        fileSize: file.size,
        data: buffer,
      });

      const message = await Message.create({
        conversationId: conversation._id,
        senderId: auth.userId,
        recipientId,
        type: 'attachment',
        text: caption,
        attachment: {
          attachmentId: attachmentDoc._id,
          fileName,
          mimeType,
          fileSize: file.size,
        },
        status: 'sent',
        replyToMessageId: replyTarget.id ?? null,
      });

      const preview = mimeType.startsWith('image/') ? '📷 Photo' : `📎 ${fileName}`;
      await applyConversationSideEffects(conversation, auth.userId, recipientId, preview, message.createdAt);

      // Non-null: a message the sender just created is never in its own
      // deletedFor list and is never already unsent.
      return NextResponse.json<ApiResponse>(
        { success: true, data: serializeMessageForUser(message, auth.userId, replyTarget.preview)! },
        { status: 201 }
      );
    }

    // ── Plain text message ──────────────────────────────────────────────
    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Message text is required' }, { status: 400 });
    }
    if (text.length > MAX_CAPTION_LENGTH) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Message is too long' }, { status: 400 });
    }

    const replyTarget = await resolveReplyTarget(conversation._id, body.replyToMessageId);
    if (replyTarget.error) {
      return NextResponse.json<ApiResponse>({ success: false, error: replyTarget.error }, { status: 400 });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: auth.userId,
      recipientId,
      type: 'text',
      text,
      status: 'sent',
      replyToMessageId: replyTarget.id ?? null,
    });

    await applyConversationSideEffects(conversation, auth.userId, recipientId, text, message.createdAt);

    return NextResponse.json<ApiResponse>(
      { success: true, data: serializeMessageForUser(message, auth.userId, replyTarget.preview)! },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/chats/[conversationId]/messages]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}