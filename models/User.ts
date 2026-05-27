import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password: string;
  condition?: 'Diabetes' | 'Hypertension' | 'Both';
  onboardingCompleted: boolean;
  patientId: string;
  monitoredPatients: string[];
  authorizedMonitors: string[];
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
    condition: {
      type: String,
      enum: ['Diabetes', 'Hypertension', 'Both'],
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
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);