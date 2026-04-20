import mongoose, { Document } from 'mongoose';
 
export interface SensorDataDoc extends Document {
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
