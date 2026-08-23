import mongoose, { Document } from 'mongoose';
 
export interface MedicineDoc extends Document {
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
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}