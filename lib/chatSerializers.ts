// lib/chatSerializers.ts
import type { IMessageDocument } from '@/models/Message';

export interface SerializedChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  type: 'text' | 'attachment';
  text: string;
  attachment: {
    attachmentId: string;
    url: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  } | null;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  unsent: boolean;
}

/**
 * Serializes a message for a specific viewer.
 *
 * Returns `null` if this message must be completely invisible to that
 * viewer — that's the "Unsend for you" case: the requesting user is in
 * `deletedFor`, so it's dropped from their list entirely, on the initial
 * load and on every subsequent poll. The other participant is unaffected.
 *
 * A message unsent "for everyone" is NOT hidden — every participant still
 * gets an entry for it (so message order/spacing doesn't shift), but its
 * content is replaced with an empty tombstone and `unsent: true`, which the
 * client renders as "message was unsent".
 */
export function serializeMessageForUser(
  m: IMessageDocument,
  viewerId: string
): SerializedChatMessage | null {
  if (m.deletedFor.some((id) => id.toString() === viewerId)) {
    return null;
  }

  if (m.unsentForEveryone) {
    return {
      _id: m._id.toString(),
      conversationId: m.conversationId.toString(),
      senderId: m.senderId.toString(),
      recipientId: m.recipientId.toString(),
      type: m.type,
      text: '',
      attachment: null,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      unsent: true,
    };
  }

  return {
    _id: m._id.toString(),
    conversationId: m.conversationId.toString(),
    senderId: m.senderId.toString(),
    recipientId: m.recipientId.toString(),
    type: m.type,
    text: m.text,
    attachment: m.attachment
      ? {
          attachmentId: m.attachment.attachmentId.toString(),
          url: `/api/chats/attachments/${m.attachment.attachmentId.toString()}`,
          fileName: m.attachment.fileName,
          mimeType: m.attachment.mimeType,
          fileSize: m.attachment.fileSize,
        }
      : null,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    unsent: false,
  };
}