// lib/interfaces/data/Chat.ts

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  status: MessageStatus;
  createdAt: string;
  clientId?: string; // used client-side for optimistic messages before server confirms
}

export interface ConversationParticipant {
  userId: string;
  name: string;
  patientId: string;
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