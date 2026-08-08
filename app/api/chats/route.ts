// app/api/chats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import User from '@/models/User';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import type { ConversationSummary } from '@/lib/interfaces/data/Chat';

const TYPING_TTL_MS = 6000;

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ── GET /api/chats — list all active conversations for the current user ───
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const conversations = await Conversation.find({
      participants: auth.userId,
      deletedFor: { $ne: auth.userId },
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('participants', 'firstName lastName patientId')
      .lean();

    const now = Date.now();

    const summaries: ConversationSummary[] = await Promise.all(
      conversations.map(async (c) => {
        type PopulatedUser = { _id: { toString(): string }; firstName?: string; lastName?: string; patientId?: string };
        const participants = c.participants as unknown as PopulatedUser[];
        const other = participants.find((p) => p._id.toString() !== auth.userId);

        const customName = c.contactNames?.get?.(auth.userId) || (c.contactNames as unknown as Record<string, string>)?.[auth.userId];
        const fallbackName = other ? `${other.firstName ?? ''} ${other.lastName ?? ''}`.trim() : 'Unknown user';
        const customAvatar = c.contactAvatars?.get?.(auth.userId) || (c.contactAvatars as unknown as Record<string, string>)?.[auth.userId];

        const unreadCount = await Message.countDocuments({
          conversationId: c._id,
          recipientId: auth.userId,
          status: { $ne: 'read' },
        });

        let isTyping = false;
        if (other) {
          const typingMap = c.typing as unknown as Map<string, Date> | Record<string, Date> | undefined;
          const otherId = other._id.toString();
          const rawTs = typingMap instanceof Map ? typingMap.get(otherId) : typingMap?.[otherId];
          if (rawTs) {
            const ts = new Date(rawTs).getTime();
            isTyping = now - ts < TYPING_TTL_MS;
          }
        }

        return {
          conversationId: c._id.toString(),
          contact: {
            userId: other?._id.toString() ?? '',
            name: customName || fallbackName || 'Unknown user',
            patientId: other?.patientId ?? '',
            avatarUrl: customAvatar || null,
          },
          lastMessage: c.lastMessageText
            ? {
                text: c.lastMessageText,
                senderId: c.lastMessageSenderId?.toString() ?? '',
                createdAt: c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : '',
              }
            : null,
          unreadCount,
          updatedAt: (c.lastMessageAt ?? c.updatedAt ?? c.createdAt) as unknown as string,
          isTyping,
        };
      })
    );

    // updatedAt fields above may still be Date objects (from lean()); normalize
    const normalized = summaries.map((s) => ({
      ...s,
      updatedAt: new Date(s.updatedAt).toISOString(),
    }));

    return NextResponse.json<ApiResponse>({ success: true, data: normalized });
  } catch (error) {
    console.error('[GET /api/chats]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST /api/chats — add a contact by Patient ID and (re)open a conversation
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const patientId = typeof body.patientId === 'string' ? body.patientId.trim().toUpperCase() : '';
    const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : '';

    if (!patientId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Patient ID is required' }, { status: 400 });
    }
    if (!contactName) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Contact name is required' }, { status: 400 });
    }

    await connectDB();

    const currentUser = await User.findById(auth.userId).select('patientId');
    if (!currentUser) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (currentUser.patientId === patientId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'You cannot add yourself as a contact' }, { status: 400 });
    }

    // Validate the target patient ID exists
    const targetUser = await User.findOne({ patientId }).select('_id firstName lastName patientId');
    if (!targetUser) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'No patient found with this ID' }, { status: 404 });
    }

    // Look for an existing conversation between these two users
    let conversation = await Conversation.findOne({
      participants: { $all: [auth.userId, targetUser._id], $size: 2 },
    });

    if (conversation && !conversation.deletedFor.some((id) => id.toString() === auth.userId)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'This contact has already been added' }, { status: 409 });
    }

    if (conversation) {
      // Re-activate a conversation this user had previously removed
      conversation.deletedFor = conversation.deletedFor.filter((id) => id.toString() !== auth.userId);
      conversation.contactNames.set(auth.userId, contactName);
      await conversation.save();
    } else {
      conversation = await Conversation.create({
        participants: [auth.userId, targetUser._id],
        contactNames: { [auth.userId]: contactName },
        deletedFor: [],
      });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        conversationId: conversation._id.toString(),
        contact: {
          userId: targetUser._id.toString(),
          name: contactName,
          patientId: targetUser.patientId,
          avatarUrl: null,
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/chats]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}