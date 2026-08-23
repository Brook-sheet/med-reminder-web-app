// models/Medicine.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMedicineDocument extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  chamberId?: number | null;
  windowBeforeMinutes: number;
  windowAfterMinutes: number;
  lateAfterMinutes: number;
  notes: string;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MedicineSchema = new Schema<IMedicineDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
    },
    dosage: {
      type: String,
      required: [true, 'Dosage is required'],
      trim: true,
    },
    frequency: {
      type: String,
      required: [true, 'Frequency is required'],
      default: 'Once daily',
    },
    scheduledTimes: {
      type: [String],
      required: [true, 'At least one scheduled time is required'],
      validate: {
        validator: (times: string[]) => times.length > 0,
        message: 'At least one scheduled time is required',
      },
    },
    chamberId: {
      type: Number,
      min: 1,
      max: 3,
      default: null,
      index: true,
    },
    windowBeforeMinutes: {
      type: Number,
      min: 0,
      max: 720,
      default: 30,
    },
    windowAfterMinutes: {
      type: Number,
      min: 0,
      max: 720,
      default: 90,
    },
    lateAfterMinutes: {
      type: Number,
      min: 0,
      max: 720,
      default: 30,
    },
    notes: {
      type: String,
      default: '',
    },
    startDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    endDate: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Medicine: Model<IMedicineDocument> =
  mongoose.models.Medicine || mongoose.model<IMedicineDocument>('Medicine', MedicineSchema);

export default Medicine;