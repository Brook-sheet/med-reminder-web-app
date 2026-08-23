import mongoose, { Document, Model, Schema } from 'mongoose';

export type ChatRequestStatus = 'pending' | 'accepted' | 'declined';

export interface IChatRequest extends Document {
  _id: mongoose.Types.ObjectId;
  requesterId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  pairKey: string;
  status: ChatRequestStatus;
  requestedContactName?: string;
  respondedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChatRequestSchema = new Schema<IChatRequest>(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pairKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
      required: true,
      index: true,
    },
    requestedContactName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

ChatRequestSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
ChatRequestSchema.index({ requesterId: 1, status: 1, createdAt: -1 });

const ChatRequest: Model<IChatRequest> =
  mongoose.models.ChatRequest ||
  mongoose.model<IChatRequest>('ChatRequest', ChatRequestSchema);

export default ChatRequest;