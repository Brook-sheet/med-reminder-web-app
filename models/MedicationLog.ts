// models/MedicationLog.ts
import mongoose, {
  Schema,
  Document,
  Model,
} from 'mongoose';

export interface IMedicationLogDocument
  extends Document<mongoose.Types.ObjectId> {
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

  /**
   * Backward-compatible first chamber.
   * expectedChamberIds is authoritative.
   */
  expectedChamberId?: number | null;

  /**
   * Legacy field. The tray ultrasonic sensor does not
   * detect a chamber and must not populate this field.
   */
  detectedChamberId?: number | null;

  expectedChamberIds: number[];

  windowBeforeMinutes: number;
  windowAfterMinutes: number;
  lateAfterMinutes: number;
  countsTowardAdherence: boolean;
  verificationNote?: string;
  sensorDeviceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MedicationLogSchema =
  new Schema<IMedicationLogDocument>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
      },

      medicineId: {
        type: Schema.Types.ObjectId,
        ref: 'Medicine',
        default: null,
      },

      medicineName: {
        type: String,
        required: true,
      },

      dosage: {
        type: String,
        default: '',
      },

      scheduledTime: {
        type: String,
        required: true,
      },

      scheduledDate: {
        type: String,
        required: true,
        index: true,
      },

      takenAt: {
        type: Date,
        default: null,
      },

      status: {
        type: String,
        enum: [
          'pending',
          'dispensed',
          'taken',
          'missed',
          'late',
          'unverified',
          'incorrect_chamber',
          'reminder',
        ],
        default: 'pending',
        index: true,
      },

      source: {
        type: String,
        enum: [
          'manual',
          'sensor',
          'system',
          'auto',
        ],
        default: 'auto',
      },

      eventType: {
        type: String,
        enum: [
          'CHAMBER_OPENED',
          'MEDICATION_DISPENSED',
          'MEDICATION_CONFIRMED',
          'MISSED',
          'SCHEDULED',
        ],
        default: 'SCHEDULED',
      },

      expectedChamberId: {
        type: Number,
        min: 1,
        max: 4,
        default: null,
      },

      detectedChamberId: {
        type: Number,
        min: 1,
        max: 4,
        default: null,
      },

      expectedChamberIds: {
        type: [Number],
        default: [],
        validate: {
          validator: (values: number[]) =>
            values.every(
              (value) =>
                Number.isInteger(value) &&
                value >= 1 &&
                value <= 4
            ),
          message:
            'Every expected chamber must be 1, 2, 3, or 4.',
        },
      },

      windowBeforeMinutes: {
        type: Number,
        default: 30,
      },

      windowAfterMinutes: {
        type: Number,
        default: 90,
      },

      lateAfterMinutes: {
        type: Number,
        default: 30,
      },

      countsTowardAdherence: {
        type: Boolean,
        default: true,
        index: true,
      },

      verificationNote: {
        type: String,
        default: '',
        maxlength: 300,
      },

      sensorDeviceId: {
        type: String,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

MedicationLogSchema.index({
  userId: 1,
  scheduledDate: 1,
});

MedicationLogSchema.index({
  userId: 1,
  status: 1,
  scheduledDate: 1,
});

MedicationLogSchema.index({
  userId: 1,
  scheduledDate: 1,
  expectedChamberId: 1,
});

/*
 * CRITICAL: prevents duplicate logs for the same medicine's
 * dose slot on the same day.
 *
 * ensureMedicationLogsForDate() (called on every plan/dashboard
 * fetch) and the medicine-edit route's own log resync both
 * upsert against this exact key. Upsert alone is NOT safe
 * against two concurrent calls racing to insert the same
 * logical row - MongoDB can create two separate documents if
 * both "does this exist?" checks happen before either insert
 * commits. This unique index closes that gap: the loser of the
 * race gets a duplicate-key error instead of a phantom document.
 *
 * Scoped to medicineId being a real ObjectId so manual/free-form
 * log entries (medicineId: null) are never restricted by this.
 */
MedicationLogSchema.index(
  {
    userId: 1,
    medicineId: 1,
    scheduledDate: 1,
    scheduledTime: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      medicineId: { $type: 'objectId' },
    },
    name: 'unique_medicine_dose_slot_per_day',
  }
);

const MedicationLog:
  Model<IMedicationLogDocument> =
    mongoose.models.MedicationLog ||
    mongoose.model<IMedicationLogDocument>(
      'MedicationLog',
      MedicationLogSchema
    );

export default MedicationLog;