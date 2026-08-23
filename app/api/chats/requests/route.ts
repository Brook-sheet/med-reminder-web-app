import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { ensureAcceptedConversation } from '@/lib/chatRelationship';
import ChatRequest from '@/models/ChatRequest';
import Notification from '@/models/Notification';
import User from '@/models/User';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  return token ? verifyToken(token) : null;
}

function publicUser(user: {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  patientId?: string;
  familyId?: string;
  role?: 'patient' | 'family';
}) {
  const role = user.role === 'family' ? 'family' : 'patient';

  return {
    userId: user._id.toString(),
    name:
      [user.firstName, user.middleName, user.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Unknown user',
    role,
    identifier: role === 'family' ? user.familyId ?? '' : user.patientId ?? '',
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const [receivedDocs, sentDocs] = await Promise.all([
      ChatRequest.find({
        recipientId: auth.userId,
        status: 'pending',
      })
        .sort({ createdAt: -1 })
        .populate(
          'requesterId',
          'firstName middleName lastName patientId familyId role'
        )
        .lean(),

      ChatRequest.find({
        requesterId: auth.userId,
        status: { $in: ['pending', 'declined'] },
      })
        .sort({ updatedAt: -1 })
        .limit(20)
        .populate(
          'recipientId',
          'firstName middleName lastName patientId familyId role'
        )
        .lean(),
    ]);

    type PopulatedUser = Parameters<typeof publicUser>[0];

    const received = receivedDocs
      .filter((item) => item.requesterId)
      .map((item) => ({
        requestId: item._id.toString(),
        user: publicUser(item.requesterId as unknown as PopulatedUser),
        status: item.status,
        direction: 'received' as const,
        createdAt: item.createdAt,
        respondedAt: item.respondedAt ?? null,
      }));

    const sent = sentDocs
      .filter((item) => item.recipientId)
      .map((item) => ({
        requestId: item._id.toString(),
        user: publicUser(item.recipientId as unknown as PopulatedUser),
        status: item.status,
        direction: 'sent' as const,
        createdAt: item.createdAt,
        respondedAt: item.respondedAt ?? null,
      }));

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        received,
        sent,
        pendingReceivedCount: received.length,
      },
    });
  } catch (error) {
    console.error('[GET /api/chats/requests]', error);

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const requestId =
      typeof body.requestId === 'string' ? body.requestId : '';
    const action = body.action as 'accept' | 'decline' | undefined;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid Message Request ID.' },
        { status: 400 }
      );
    }

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Action must be accept or decline.' },
        { status: 400 }
      );
    }

    await connectDB();

    const currentUser = await User.findById(auth.userId).select(
      '_id firstName lastName role isDeleted'
    );

    if (!currentUser || currentUser.isDeleted) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const chatRequest = await ChatRequest.findOne({
      _id: requestId,
      recipientId: currentUser._id,
      status: 'pending',
    });

    if (!chatRequest) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'This pending Message Request was not found or is not addressed to you.',
        },
        { status: 404 }
      );
    }

    const nextStatus = action === 'accept' ? 'accepted' : 'declined';

    chatRequest.status = nextStatus;
    chatRequest.respondedAt = new Date();
    await chatRequest.save();

    let conversationId: string | null = null;

    if (nextStatus === 'accepted') {
      const conversation = await ensureAcceptedConversation(
        chatRequest.requesterId,
        chatRequest.recipientId
      );

      if (chatRequest.requestedContactName) {
        conversation.contactNames.set(
          chatRequest.requesterId.toString(),
          chatRequest.requestedContactName
        );
        await conversation.save();
      }

      conversationId = conversation._id.toString();
    }

    await Notification.updateMany(
      {
        userId: currentUser._id,
        type: 'chat_request',
        chatRequestId: chatRequest._id,
      },
      {
        $set: {
          read: true,
        },
      }
    );

    const responderName =
      `${currentUser.firstName ?? ''} ${currentUser.lastName ?? ''}`.trim() ||
      'The recipient';

    await Notification.create({
      userId: chatRequest.requesterId,
      type:
        nextStatus === 'accepted'
          ? 'chat_request_accepted'
          : 'chat_request_declined',
      title:
        nextStatus === 'accepted'
          ? 'Message Request Accepted'
          : 'Message Request Declined',
      message:
        nextStatus === 'accepted'
          ? `${responderName} accepted your Message Request.`
          : `${responderName} declined your Message Request.`,
      chatRequestId: chatRequest._id,
      read: false,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message:
        nextStatus === 'accepted'
          ? 'Message Request accepted. Chat is now available.'
          : 'Message Request declined.',
      data: {
        requestId: chatRequest._id.toString(),
        status: nextStatus,
        conversationId,
      },
    });
  } catch (error) {
    console.error('[PATCH /api/chats/requests]', error);

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}