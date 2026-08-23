// app/api/chats/[conversationId]/typing/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ── POST /api/chats/[conversationId]/typing — ping "is typing" state ──────
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
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid conversation ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const isTyping = body.isTyping !== false;

    await connectDB();

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: auth.userId,
      deletedFor: { $size: 0 },
    });
    if (!conversation) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conversation not found' }, { status: 404 });
    }

    if (isTyping) {
      conversation.typing.set(auth.userId, new Date());
    } else {
      conversation.typing.delete(auth.userId);
    }
    await conversation.save();

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (error) {
    console.error('[POST /api/chats/[conversationId]/typing]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}