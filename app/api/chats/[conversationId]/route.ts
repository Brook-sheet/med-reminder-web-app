// app/api/chats/[conversationId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import Attachment from '@/models/Attachment';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
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
      await Attachment.deleteMany({ conversationId: conversation._id });
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