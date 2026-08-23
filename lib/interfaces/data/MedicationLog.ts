export interface MedicationLog {
  _id?: string;
  userId: string;
  medicineId?: string | null;
  medicineName: string;
  scheduledTime: string;
  scheduledDate: string;
  takenAt?: Date;
  status: 'pending' | 'dispensed' | 'taken' | 'missed' | 'late' | 'unverified' | 'incorrect_chamber' | 'reminder';
  source: 'manual' | 'sensor' | 'system' | 'auto';
  eventType?: 'CHAMBER_OPENED' | 'MEDICATION_CONFIRMED' | 'MISSED' | 'SCHEDULED';
  expectedChamberId?: number | null;
  detectedChamberId?: number | null;
  expectedChamberIds?: number[];
  countsTowardAdherence?: boolean;
  verificationNote?: string;
  createdAt?: Date;
  updatedAt?: Date;
}