// lib/interfaces/documents/MedicineDoc.ts
import mongoose, {
  Document,
} from 'mongoose';

export interface MedicineDoc
  extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  pillsPerDose: number;

  /**
   * Legacy data only.
   * The daily Rx Box plan owns chamber assignment.
   */
  chamberId?: number | null;

  windowBeforeMinutes: number;
  windowAfterMinutes: number;
  lateAfterMinutes: number;
  notes: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}