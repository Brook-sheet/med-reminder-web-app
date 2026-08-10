// lib/interfaces/data/Chat.ts

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageType = 'text' | 'attachment';

export interface MessageAttachment {
  attachmentId: string;
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
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
  clientId?: string; // used client-side for optimistic messages before server confirms
  uploadProgress?: number; // 0-100, only set while an attachment is uploading
  localPreviewUrl?: string; // client-only object URL for instant image preview pre-upload
  unsent?: boolean; // true once "unsent for everyone" — render as a tombstone
}

export interface ConversationParticipant {
  userId: string;
  name: string;
  patientId: string;
  avatarUrl: string | null; // data URI the current user set for this contact, if any
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