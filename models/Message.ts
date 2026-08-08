// models/Message.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessageAttachmentMeta {
  attachmentId: mongoose.Types.ObjectId;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface IMessageDocument extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  type: 'text' | 'attachment';
  text: string;
  attachment: IMessageAttachmentMeta | null;
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
  updatedAt: Date;
}

const MessageAttachmentSchema = new Schema<IMessageAttachmentMeta>(
  {
    attachmentId: { type: Schema.Types.ObjectId, ref: 'Attachment', required: true },
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true, trim: true, maxlength: 127 },
    fileSize: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessageDocument>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['text', 'attachment'], default: 'text' },
    text: { type: String, trim: true, maxlength: 4000, default: '' },
    attachment: { type: MessageAttachmentSchema, default: null },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ recipientId: 1, status: 1 });

const Message: Model<IMessageDocument> =
  mongoose.models.Message || mongoose.model<IMessageDocument>('Message', MessageSchema);

export default Message;