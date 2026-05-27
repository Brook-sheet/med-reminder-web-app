// models/User.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password: string;
  age?: number;
  condition?: string;
  onboardingCompleted: boolean;
  patientId: string;
  monitoredPatients: string[];
  authorizedMonitors: string[];
  isDeleted?: boolean;
  dataResetAt?: Date;
  lastRiskLevel?: string; // NEW
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    firstName:  { type: String, default: '', trim: true },
    middleName: { type: String, default: '', trim: true },
    lastName:   { type: String, default: '', trim: true },
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:   { type: String, required: true },
    age: {
      type: Number,
      default: null,
    },
    condition: {
      type: String,
      enum: ['Diabetes', 'Hypertension', 'Both', 'Other', 'None'],
      required: false,
      default: null,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    patientId: {
      type: String,
      unique: true,
      sparse: true,
    },
    monitoredPatients: {
      type: [String],
      default: [],
    },
    authorizedMonitors: {
      type: [String],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    dataResetAt: {
      type: Date,
      default: null,
    },
    lastRiskLevel: {       // NEW
      type: String,
      enum: ['Low', 'Moderate', 'High'],
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);