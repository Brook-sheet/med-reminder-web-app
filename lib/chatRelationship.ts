import mongoose from 'mongoose';
import ChatRequest from '@/models/ChatRequest';
import Conversation from '@/models/Conversation';

export type ChatRelationshipState =
  | 'none'
  | 'pending'
  | 'accepted'
  | 'declined';

export function makeParticipantKey(
  firstUserId: string | mongoose.Types.ObjectId,
  secondUserId: string | mongoose.Types.ObjectId
) {
  return [firstUserId.toString(), secondUserId.toString()].sort().join(':');
}

export async function findPairConversation(
  firstUserId: string | mongoose.Types.ObjectId,
  secondUserId: string | mongoose.Types.ObjectId
) {
  const pairKey = makeParticipantKey(firstUserId, secondUserId);

  return Conversation.findOne({
    $or: [
      { participantKey: pairKey },
      {
        participants: {
          $all: [firstUserId, secondUserId],
          $size: 2,
        },
      },
    ],
  });
}

export function isConversationActiveForPair(
  conversation: {
    deletedFor?: Array<string | mongoose.Types.ObjectId>;
  } | null,
  firstUserId: string | mongoose.Types.ObjectId,
  secondUserId: string | mongoose.Types.ObjectId
) {
  if (!conversation) return false;

  const removedFor = new Set(
    (conversation.deletedFor ?? []).map((userId) => userId.toString())
  );

  return (
    !removedFor.has(firstUserId.toString()) &&
    !removedFor.has(secondUserId.toString())
  );
}

export async function ensureAcceptedConversation(
  firstUserId: string | mongoose.Types.ObjectId,
  secondUserId: string | mongoose.Types.ObjectId
) {
  const pairKey = makeParticipantKey(firstUserId, secondUserId);
  let conversation = await findPairConversation(firstUserId, secondUserId);

  if (conversation) {
    if (!conversation.participantKey) {
      conversation.participantKey = pairKey;
    }
    conversation.deletedFor = [];
    await conversation.save();
    return conversation;
  }

  try {
    return await Conversation.create({
      participantKey: pairKey,
      participants: [firstUserId, secondUserId],
      contactNames: {},
      contactAvatars: {},
      deletedFor: [],
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      Number((error as { code?: unknown }).code) === 11000
    ) {
      conversation = await findPairConversation(firstUserId, secondUserId);
      if (conversation) return conversation;
    }
    throw error;
  }
}

export async function getChatRelationshipSummary(
  currentUserId: string | mongoose.Types.ObjectId,
  otherUserId: string | mongoose.Types.ObjectId
) {
  const pairKey = makeParticipantKey(currentUserId, otherUserId);
  const request = await ChatRequest.findOne({ pairKey }).lean();

  if (request) {
    const conversation =
      request.status === 'accepted'
        ? await findPairConversation(currentUserId, otherUserId)
        : null;

    // An accepted request is not an active contact after either participant
    // removes the conversation. The users must complete a new Message Request
    // before the existing conversation can be restored.
    if (
      request.status === 'accepted' &&
      !isConversationActiveForPair(conversation, currentUserId, otherUserId)
    ) {
      return {
        status: 'none' as const,
        direction: null,
        requestId: null,
        conversationId: null,
      };
    }

    return {
      status: request.status as ChatRelationshipState,
      direction:
        request.requesterId.toString() === currentUserId.toString()
          ? ('sent' as const)
          : ('received' as const),
      requestId: request._id.toString(),
      conversationId: conversation?._id.toString() ?? null,
    };
  }

  // Conversations created before Message Requests were introduced remain
  // valid chat contacts. This preserves existing conversation history.
  const legacyConversation = await findPairConversation(currentUserId, otherUserId);
  if (
    legacyConversation &&
    isConversationActiveForPair(
      legacyConversation,
      currentUserId,
      otherUserId
    )
  ) {
    return {
      status: 'accepted' as const,
      direction: null,
      requestId: null,
      conversationId: legacyConversation._id.toString(),
    };
  }

  return {
    status: 'none' as const,
    direction: null,
    requestId: null,
    conversationId: null,
  };
}