// models/Medicine.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMedicineDocument extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  notes: string;
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
    notes: {
      type: String,
      default: '',
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