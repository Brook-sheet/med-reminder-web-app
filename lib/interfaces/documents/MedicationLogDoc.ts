import mongoose, { Document } from 'mongoose';
 
export interface MedicationLogDoc extends Document {
  userId: mongoose.Types.ObjectId;
  medicineId?: mongoose.Types.ObjectId | null;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  scheduledDate: string;
  takenAt?: Date;
  status: 'pending' | 'dispensed' | 'taken' | 'missed' | 'late' | 'unverified' | 'incorrect_chamber' | 'reminder';
  source: 'manual' | 'sensor' | 'system' | 'auto';
  eventType?: 'CHAMBER_OPENED' | 'MEDICATION_DISPENSED' | 'MEDICATION_CONFIRMED' | 'MISSED' | 'SCHEDULED';
  expectedChamberId?: number | null;
  detectedChamberId?: number | null;
  expectedChamberIds: number[];
  countsTowardAdherence: boolean;
  verificationNote?: string;
  sensorDeviceId?: string;
  createdAt: Date;
  updatedAt: Date;
}