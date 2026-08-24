import mongoose from 'mongoose';
import Conversation from '@/models/Conversation';
import MonitoringRequest from '@/models/MonitoringRequest';

export async function hasApprovedMonitoringRelationship(
  firstUserId: string | mongoose.Types.ObjectId,
  secondUserId: string | mongoose.Types.ObjectId
): Promise<boolean> {
  const relationship = await MonitoringRequest.exists({
    status: 'approved',
    $or: [
      {
        patientId: firstUserId,
        familyId: secondUserId,
      },
      {
        patientId: secondUserId,
        familyId: firstUserId,
      },
    ],
  });

  return Boolean(relationship);
}

export async function getAuthorizedConversation(
  conversationId: string,
  userId: string
) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return null;
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });

  if (!conversation) {
    return null;
  }

  const otherUserId = conversation.participants.find(
    (participantId) =>
      participantId.toString() !== userId
  );

  if (!otherUserId) {
    return null;
  }

  const approved =
    await hasApprovedMonitoringRelationship(
      userId,
      otherUserId
    );

  return approved ? conversation : null;
}

export async function getApprovedConversationIdsForUser(
  userId: string
) {
  const relationships = await MonitoringRequest.find({
    status: 'approved',
    $or: [
      {
        patientId: userId,
      },
      {
        familyId: userId,
      },
    ],
  })
    .select('patientId familyId')
    .lean();

  const approvedOtherIds = relationships.map(
    (relationship) =>
      relationship.patientId.toString() === userId
        ? relationship.familyId
        : relationship.patientId
  );

  if (approvedOtherIds.length === 0) {
    return [];
  }

  return Conversation.find({
    participants: userId,
    $and: [
      {
        participants: {
          $in: approvedOtherIds,
        },
      },
    ],
    deletedFor: {
      $ne: userId,
    },
  }).distinct('_id');
}

export async function getApprovedPatientIdsForMonitor(
  monitorId: string | mongoose.Types.ObjectId
) {
  return MonitoringRequest.find({
    familyId: monitorId,
    status: 'approved',
  }).distinct('patientId');
}

export async function ensureApprovedConversation(
  patientId: string,
  familyId: string
) {
  let conversation = await Conversation.findOne({
    participants: {
      $all: [patientId, familyId],
      $size: 2,
    },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [patientId, familyId],
      contactNames: {},
      contactAvatars: {},
      deletedFor: [],
    });
  } else {
    conversation.deletedFor = [];
    await conversation.save();
  }

  return conversation;
}