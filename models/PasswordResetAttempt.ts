// models/PasswordResetAttempt.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

// A lightweight, append-only log of every forgot-password / verify-code hit,
// keyed by both the submitted email and the requester's IP. Rate limiting
// reads from this collection instead of an in-memory counter because the app
// may run as multiple serverless instances — an in-process counter would
// reset per-instance and not actually protect anything.
export type PasswordResetAttemptType = 'request' | 'verify';

export interface IPasswordResetAttemptDocument extends Document {
  _id: mongoose.Types.ObjectId;
  type: PasswordResetAttemptType;
  email: string;
  ip: string;
  createdAt: Date;
}

const PasswordResetAttemptSchema = new Schema<IPasswordResetAttemptDocument>(
  {
    type: { type: String, enum: ['request', 'verify'], required: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    ip: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Auto-expire log rows after 1 hour — rate-limit windows never need to look
// back further than that, so there's no reason to keep them longer.
PasswordResetAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 });

const PasswordResetAttempt: Model<IPasswordResetAttemptDocument> =
  mongoose.models.PasswordResetAttempt ||
  mongoose.model<IPasswordResetAttemptDocument>('PasswordResetAttempt', PasswordResetAttemptSchema);

export default PasswordResetAttempt;