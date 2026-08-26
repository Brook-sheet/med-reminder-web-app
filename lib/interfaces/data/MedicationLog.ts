export interface MedicationAnnotation {
  _id?: string;

  type:
    | 'patient_note'
    | 'missed_explanation'
    | 'family_acknowledgment';

  text: string;
  authorRole: 'patient' | 'family';
  authorName: string;
  createdAt: string | Date;
}

export interface MedicationLog {
  _id?: string;
  userId: string;
  medicineId?: string | null;
  medicineName: string;
  scheduledTime: string;
  scheduledDate: string;
  takenAt?: Date;

  status:
    | 'pending'
    | 'dispensed'
    | 'taken'
    | 'missed'
    | 'late'
    | 'unverified'
    | 'incorrect_chamber'
    | 'reminder';

  source:
    | 'manual'
    | 'sensor'
    | 'system'
    | 'auto';

  eventType?:
    | 'CHAMBER_OPENED'
    | 'MEDICATION_DISPENSED'
    | 'MEDICATION_CONFIRMED'
    | 'MISSED'
    | 'SCHEDULED';

  expectedChamberId?: number | null;
  detectedChamberId?: number | null;
  expectedChamberIds?: number[];
  countsTowardAdherence?: boolean;
  verificationNote?: string;
  annotations?: MedicationAnnotation[];
  createdAt?: Date;
  updatedAt?: Date;
}