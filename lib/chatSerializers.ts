// lib/chatSerializers.ts
import type { IMessageDocument } from '@/models/Message';

export interface SerializedReplyPreview {
  messageId: string;
  senderId: string;
  // Already-resolved snippet: the actual text, "📷 Photo" / "📎 filename"
  // for an attachment, or "" when the referenced message was unsent.
  text: string;
  unsent: boolean;
}

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
  replyTo: SerializedReplyPreview | null;
}

/**
 * Builds the quoted preview shown in a reply composer / reply bubble for a
 * given referenced message. This is resolved LIVE from the referenced
 * message's current document rather than snapshotted at reply-creation
 * time, so if the original is later unsent, every reply quoting it updates
 * to reflect that automatically instead of showing stale content.
 */
export function buildReplyPreview(m: IMessageDocument): SerializedReplyPreview {
  if (m.unsentForEveryone) {
    return { messageId: m._id.toString(), senderId: m.senderId.toString(), text: '', unsent: true };
  }
  const text =
    m.type === 'attachment' && m.attachment
      ? m.attachment.mimeType.startsWith('image/')
        ? '📷 Photo'
        : `📎 ${m.attachment.fileName}`
      : m.text;
  return { messageId: m._id.toString(), senderId: m.senderId.toString(), text, unsent: false };
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
 *
 * `replyPreview` is resolved by the caller (a single batched lookup covers
 * a whole page of messages) and passed in here purely for shaping into the
 * response — this function does no DB access itself.
 */
export function serializeMessageForUser(
  m: IMessageDocument,
  viewerId: string,
  replyPreview: SerializedReplyPreview | null = null
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
      replyTo: replyPreview,
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
    replyTo: replyPreview,
  };
}