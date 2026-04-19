// models/SensorData.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISensorDataDocument extends Document {
  userId?: mongoose.Types.ObjectId;
  deviceId: string;
  event: 'pill_taken' | 'pill_dispensed' | 'container_opened' | 'heartbeat';
  medicineId?: mongoose.Types.ObjectId;
  medicineName?: string;
  timestamp: Date;
  rawData?: Record<string, unknown>;
  processed: boolean;
  createdAt: Date;
}

const SensorDataSchema = new Schema<ISensorDataDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      index: true,
    },
    event: {
      type: String,
      enum: ['pill_taken', 'pill_dispensed', 'container_opened', 'heartbeat'],
      required: true,
    },
    medicineId: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      default: null,
    },
    medicineName: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    rawData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    processed: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const SensorData: Model<ISensorDataDocument> =
  mongoose.models.SensorData ||
  mongoose.model<ISensorDataDocument>('SensorData', SensorDataSchema);

export default SensorData;
