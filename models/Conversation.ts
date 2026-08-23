// models/Conversation.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IConversationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[]; // exactly 2 users
  participantKey?: string; // canonical, order-independent pair key
  contactNames: Map<string, string>; // per-user custom label for the other participant
  contactAvatars: Map<string, string>; // per-user custom avatar for the other participant
  deletedFor: mongoose.Types.ObjectId[];
  lastMessageText: string | null;
  lastMessageAt: Date | null;
  lastMessageSenderId: mongoose.Types.ObjectId | null;
  typing: Map<string, Date>;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversationDocument>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: {
        validator: (v: mongoose.Types.ObjectId[]) => v.length === 2,
        message: 'A conversation must have exactly 2 participants',
      },
    },
    participantKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    contactNames: {
      type: Map,
      of: String,
      default: {},
    },
    contactAvatars: {
      type: Map,
      of: String,
      default: {},
    },
    deletedFor: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    lastMessageText: {
      type: String,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    lastMessageSenderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    typing: {
      type: Map,
      of: Date,
      default: {},
    },
  },
  { timestamps: true }
);

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });

const Conversation: Model<IConversationDocument> =
  mongoose.models.Conversation ||
  mongoose.model<IConversationDocument>(
    'Conversation',
    ConversationSchema
  );

export default Conversation;