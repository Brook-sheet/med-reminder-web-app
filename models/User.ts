import mongoose, { Schema, Model } from 'mongoose';
import type { UserDoc } from '@/lib/interfaces/documents/UserDoc';

const UserSchema = new Schema<UserDoc>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    firstName: {
      type: String,
      default: '',
      trim: true,
    },
    middleName: {
      type: String,
      default: '',
      trim: true,
    },
    lastName: {
      type: String,
      default: '',
      trim: true,
    },
    patientId: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const User: Model<UserDoc> =
  mongoose.models.User || mongoose.model<UserDoc>('User', UserSchema);

export default User;

