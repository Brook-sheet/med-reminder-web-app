import mongoose, {
  Document,
} from 'mongoose';

export interface MedicationAnnotationDoc {
  _id: mongoose.Types.ObjectId;

  type:
    | 'patient_note'
    | 'missed_explanation'
    | 'family_acknowledgment';

  text: string;
  authorId: mongoose.Types.ObjectId;
  authorRole: 'patient' | 'family';
  authorName: string;
  createdAt: Date;
}

export interface MedicationLogDoc
  extends Document {
  userId: mongoose.Types.ObjectId;
  medicineId?: mongoose.Types.ObjectId | null;
  medicineName: string;
  dosage: string;
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
  expectedChamberIds: number[];
  countsTowardAdherence: boolean;
  verificationNote?: string;
  sensorDeviceId?: string;
  annotations: MedicationAnnotationDoc[];
  createdAt: Date;
  updatedAt: Date;
}