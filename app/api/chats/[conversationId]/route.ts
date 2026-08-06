// app/api/chats/[conversationId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
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

// ── DELETE /api/chats/[conversationId] — remove a contact from *my* chat list
// Only hides the conversation for the requesting user. Messages/history are
// only permanently deleted once BOTH participants have removed it.
export async function DELETE(
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

    await connectDB();

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: auth.userId,
    });

    if (!conversation) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conversation not found' }, { status: 404 });
    }

    if (!conversation.deletedFor.some((id) => id.toString() === auth.userId)) {
      conversation.deletedFor.push(new mongoose.Types.ObjectId(auth.userId));
    }

    const bothDeleted = conversation.participants.every((p) =>
      conversation.deletedFor.some((d) => d.toString() === p.toString())
    );

    if (bothDeleted) {
      await Message.deleteMany({ conversationId: conversation._id });
      await Conversation.deleteOne({ _id: conversation._id });
    } else {
      await conversation.save();
    }

    return NextResponse.json<ApiResponse>({ success: true, message: 'Contact removed' });
  } catch (error) {
    console.error('[DELETE /api/chats/[conversationId]]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}