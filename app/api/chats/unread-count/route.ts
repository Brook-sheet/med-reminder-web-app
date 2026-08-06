// app/api/chats/unread-count/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ── GET /api/chats/unread-count — total unread messages across all chats ──
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const activeConversationIds = await Conversation.find({
      participants: auth.userId,
      deletedFor: { $ne: auth.userId },
    }).distinct('_id');

    const unreadCount = await Message.countDocuments({
      conversationId: { $in: activeConversationIds },
      recipientId: auth.userId,
      status: { $ne: 'read' },
    });

    return NextResponse.json<ApiResponse>({ success: true, data: { unreadCount } });
  } catch (error) {
    console.error('[GET /api/chats/unread-count]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}