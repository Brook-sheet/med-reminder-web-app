// models/Attachment.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

// Files this large as base64 in JSON would be huge; keep a sane hard cap so a
// single attachment (plus its Message/Conversation siblings) always stays
// comfortably under MongoDB's 16MB per-document limit.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export interface IAttachmentDocument extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  uploaderId: mongoose.Types.ObjectId;
  fileName: string;
  mimeType: string;
  fileSize: number;
  data: Buffer;
  createdAt: Date;
}

const AttachmentSchema = new Schema<IAttachmentDocument>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    uploaderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true, trim: true, maxlength: 127 },
    fileSize: { type: Number, required: true, min: 0, max: MAX_ATTACHMENT_BYTES },
    data: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const Attachment: Model<IAttachmentDocument> =
  mongoose.models.Attachment || mongoose.model<IAttachmentDocument>('Attachment', AttachmentSchema);

export default Attachment;