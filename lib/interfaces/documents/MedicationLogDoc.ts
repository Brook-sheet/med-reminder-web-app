import mongoose, { Document } from 'mongoose';
 
export interface MedicationLogDoc extends Document {
  userId: mongoose.Types.ObjectId;
  medicineId: mongoose.Types.ObjectId;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  scheduledDate: string;
  takenAt?: Date;
  status: 'taken' | 'missed' | 'pending' | 'reminder';
  source: 'manual' | 'sensor' | 'auto';
  sensorDeviceId?: string;
  createdAt: Date;
  updatedAt: Date;
}