// models/PasswordResetToken.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

// How long a freshly-requested code stays valid before the user must request
// a new one.
export const RESET_CODE_TTL_MINUTES = 15;
// A code is invalidated after this many wrong guesses, even if it hasn't
// expired yet — this is what makes a 6-digit (1-in-a-million) code safe to
// use: an attacker gets a handful of guesses, not a million.
export const MAX_VERIFICATION_ATTEMPTS = 5;

export interface IPasswordResetTokenDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  email: string; // denormalized, lowercase — lets us look up without a User join
  codeHash: string; // HMAC-SHA256 of the 6-digit code; the raw code is never stored
  attempts: number;
  used: boolean;
  consumedAt: Date | null;
  requestIp: string | null;
  expiresAt: Date;
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    used: { type: Boolean, default: false },
    consumedAt: { type: Date, default: null },
    requestIp: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// MongoDB TTL index: once a token is 1 hour past its own expiry, the
// document is automatically dropped. This is just housekeeping — the code
// itself already stops being accepted at `expiresAt` via the application
// check below; this index just keeps the collection from growing forever.
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 });

const PasswordResetToken: Model<IPasswordResetTokenDocument> =
  mongoose.models.PasswordResetToken ||
  mongoose.model<IPasswordResetTokenDocument>('PasswordResetToken', PasswordResetTokenSchema);

export default PasswordResetToken;