// app/api/chats/[conversationId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import ChatRequest from '@/models/ChatRequest';
import Notification from '@/models/Notification';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { makeParticipantKey } from '@/lib/chatRelationship';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

// Data-URI avatars are stored inline on the Conversation document, so cap
// them well under Mongo's 16MB document limit (client already downsizes to
// a compressed 256x256 JPEG — this is just a defensive server-side ceiling).
const MAX_AVATAR_DATA_URI_LENGTH = 400_000; // ~300KB decoded

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ── PATCH /api/chats/[conversationId] — rename/re-photo a contact ─────────
// Purely local to the requesting user: only their own contactNames /
// contactAvatars map entries are touched. The other participant's account,
// profile picture, and their own copy of this conversation are untouched.
export async function PATCH(
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
    const hasName = typeof body.contactName === 'string';
    const hasAvatar = 'avatarUrl' in body; // string data URI, or null/'' to remove

    if (!hasName && !hasAvatar) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    let trimmedName = '';
    if (hasName) {
      trimmedName = body.contactName.trim();
      if (!trimmedName) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Contact name cannot be empty' }, { status: 400 });
      }
      if (trimmedName.length > 80) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Contact name is too long' }, { status: 400 });
      }
    }

    let avatarValue: string | null = null;
    if (hasAvatar) {
      const raw = body.avatarUrl;
      if (raw === null || raw === '') {
        avatarValue = null;
      } else if (typeof raw === 'string' && raw.startsWith('data:image/')) {
        if (raw.length > MAX_AVATAR_DATA_URI_LENGTH) {
          return NextResponse.json<ApiResponse>({ success: false, error: 'Image is too large' }, { status: 400 });
        }
        avatarValue = raw;
      } else {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid avatar image' }, { status: 400 });
      }
    }

    await connectDB();

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: auth.userId,
      deletedFor: { $size: 0 },
    });

    if (!conversation) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conversation not found' }, { status: 404 });
    }

    if (hasName) {
      conversation.contactNames.set(auth.userId, trimmedName);
    }
    if (hasAvatar) {
      if (avatarValue) {
        conversation.contactAvatars.set(auth.userId, avatarValue);
      } else {
        conversation.contactAvatars.delete(auth.userId);
      }
    }
    await conversation.save();

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        conversationId: conversation._id.toString(),
        contactName: conversation.contactNames.get(auth.userId) ?? null,
        avatarUrl: conversation.contactAvatars.get(auth.userId) ?? null,
      },
    });
  } catch (error) {
    console.error('[PATCH /api/chats/[conversationId]]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE /api/chats/[conversationId] — remove an active chat contact ───
// Chat access is a shared relationship, so removing the contact deactivates
// it for both participants. The conversation history remains stored and is
// restored only if a new Message Request is accepted later.
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

    conversation.deletedFor = [...conversation.participants];
    conversation.typing.clear();
    await conversation.save();

    const pairKey = makeParticipantKey(
      conversation.participants[0],
      conversation.participants[1]
    );

    const removedRequest = await ChatRequest.findOneAndDelete({ pairKey });

    if (removedRequest) {
      await Notification.deleteMany({
        chatRequestId: removedRequest._id,
      });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Chat contact removed.',
      data: {
        conversationId: conversation._id.toString(),
        relationship: {
          status: 'none',
          conversationId: null,
        },
      },
    });
  } catch (error) {
    console.error('[DELETE /api/chats/[conversationId]]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}