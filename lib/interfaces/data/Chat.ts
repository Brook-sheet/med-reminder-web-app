export type MessageStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type MessageType = 'text' | 'attachment';

export interface MessageAttachment {
  attachmentId: string;
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface MessageReplyPreview {
  messageId: string;
  senderId: string;
  text: string;
  unsent: boolean;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  type: MessageType;
  text: string;
  attachment?: MessageAttachment | null;
  status: MessageStatus;
  createdAt: string;
  clientId?: string;
  uploadProgress?: number;
  localPreviewUrl?: string;
  unsent?: boolean;
  replyTo?: MessageReplyPreview | null;
}

export interface ConversationParticipant {
  userId: string;
  name: string;
  identifier: string;
  role: 'patient' | 'family';
  avatarUrl: string | null;
}

export interface ConversationSummary {
  conversationId: string;
  contact: ConversationParticipant;
  lastMessage: {
    text: string;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
  isTyping: boolean;
}

export type ChatRequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined';

export interface ChatRequestUser {
  userId: string;
  name: string;
  role: 'patient' | 'family';
  identifier: string;
}

export interface ChatRequestSummary {
  requestId: string;
  user: ChatRequestUser;
  status: ChatRequestStatus;
  direction: 'received' | 'sent';
  createdAt: string;
  respondedAt: string | null;
}