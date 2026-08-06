// app/api/chats/[conversationId]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

const TYPING_TTL_MS = 6000;

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
        query.createdAt = { $gt: sinceDate };
      }
    }

    const messages = await Message.find(query).sort({ createdAt: since ? 1 : 1 }).limit(since ? 200 : 100);

    // If no `since` was passed, only return the most recent 100, still oldest→newest
    const trimmed = since ? messages : messages.slice(-100);

    const otherId = conversation.participants.find((p) => p.toString() !== auth.userId)?.toString();
    let otherIsTyping = false;
    if (otherId) {
      const ts = conversation.typing.get(otherId);
      if (ts) otherIsTyping = Date.now() - new Date(ts).getTime() < TYPING_TTL_MS;
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        messages: trimmed.map((m) => ({
          _id: m._id.toString(),
          conversationId: m.conversationId.toString(),
          senderId: m.senderId.toString(),
          recipientId: m.recipientId.toString(),
          text: m.text,
          status: m.status,
          createdAt: m.createdAt.toISOString(),
        })),
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

    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Message text is required' }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Message is too long' }, { status: 400 });
    }

    const recipientId = conversation.participants.find((p) => p.toString() !== auth.userId);
    if (!recipientId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conversation is missing a recipient' }, { status: 500 });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: auth.userId,
      recipientId,
      text,
      status: 'sent',
    });

    conversation.lastMessageText = text;
    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessageSenderId = new mongoose.Types.ObjectId(auth.userId);
    // Sending a message clears the sender's own typing flag
    conversation.typing.delete(auth.userId);
    // If the recipient had previously removed this conversation, a new
    // message revives it in their chat list (matches standard messaging UX).
    conversation.deletedFor = conversation.deletedFor.filter((id) => id.toString() !== recipientId.toString());
    await conversation.save();

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          _id: message._id.toString(),
          conversationId: message.conversationId.toString(),
          senderId: message.senderId.toString(),
          recipientId: message.recipientId.toString(),
          text: message.text,
          status: message.status,
          createdAt: message.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/chats/[conversationId]/messages]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}