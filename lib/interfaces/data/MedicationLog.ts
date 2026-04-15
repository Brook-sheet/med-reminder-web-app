export interface MedicationLog {
  _id?: string;
  userId: string;
  medicineId: string;
  medicineName: string;
  scheduledTime: string;
  scheduledDate: string;
  takenAt?: Date;
  status: 'taken' | 'missed' | 'pending' | 'reminder';
  source: 'manual' | 'sensor' | 'auto';
  createdAt?: Date;
  updatedAt?: Date;
}