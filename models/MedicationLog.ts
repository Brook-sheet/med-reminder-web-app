// models/MedicationLog.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMedicationLogDocument extends Document {
  userId: mongoose.Types.ObjectId;
  medicineId: mongoose.Types.ObjectId;
  medicineName: string;
  dosage: string;
  scheduledTime: string;   // "08:00 AM"
  scheduledDate: string;   // "2025-01-15"
  takenAt?: Date;
  status: 'taken' | 'missed' | 'pending' | 'reminder';
  source: 'manual' | 'sensor' | 'auto';
  sensorDeviceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MedicationLogSchema = new Schema<IMedicationLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    medicineId: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    medicineName: {
      type: String,
      required: true,
    },
    dosage: {
      type: String,
      default: '',
    },
    scheduledTime: {
      type: String,
      required: true,
    },
    scheduledDate: {
      type: String,
      required: true,
      index: true,
    },
    takenAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['taken', 'missed', 'pending', 'reminder'],
      default: 'pending',
      index: true,
    },
    source: {
      type: String,
      enum: ['manual', 'sensor', 'auto'],
      default: 'auto',
    },
    sensorDeviceId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient date-range queries
MedicationLogSchema.index({ userId: 1, scheduledDate: 1 });
MedicationLogSchema.index({ userId: 1, status: 1, scheduledDate: 1 });

const MedicationLog: Model<IMedicationLogDocument> =
  mongoose.models.MedicationLog ||
  mongoose.model<IMedicationLogDocument>('MedicationLog', MedicationLogSchema);

export default MedicationLog;

