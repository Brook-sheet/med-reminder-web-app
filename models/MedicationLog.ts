import mongoose, {
  Schema,
  Document,
  Model,
} from "mongoose";

export type MedicationAnnotationType =
  | "patient_note"
  | "missed_explanation"
  | "family_acknowledgment";

export interface IMedicationAnnotation {
  _id: mongoose.Types.ObjectId;
  type: MedicationAnnotationType;
  text: string;
  authorId: mongoose.Types.ObjectId;
  authorRole: "patient" | "family";
  authorName: string;
  createdAt: Date;
}

export interface IMedicationLogDocument
  extends Document<mongoose.Types.ObjectId> {
  userId: mongoose.Types.ObjectId;
  medicineId?:
    | mongoose.Types.ObjectId
    | null;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  scheduledDate: string;
  takenAt?: Date;
  outcomeRecordedAt?: Date | null;

  status:
    | "pending"
    | "dispensed"
    | "taken"
    | "missed"
    | "late"
    | "unverified"
    | "incorrect_chamber"
    | "reminder";

  source:
    | "manual"
    | "sensor"
    | "system"
    | "auto";

  eventType?:
    | "CHAMBER_OPENED"
    | "MEDICATION_DISPENSED"
    | "MEDICATION_CONFIRMED"
    | "MISSED"
    | "SCHEDULED";

  expectedChamberId?: number | null;
  detectedChamberId?: number | null;
  expectedChamberIds: number[];
  windowBeforeMinutes: number;
  windowAfterMinutes: number;
  lateAfterMinutes: number;
  countsTowardAdherence: boolean;
  verificationNote?: string;
  sensorDeviceId?: string;
  annotations: IMedicationAnnotation[];
  createdAt: Date;
  updatedAt: Date;
}

const MedicationAnnotationSchema =
  new Schema<IMedicationAnnotation>(
    {
      type: {
        type: String,
        enum: [
          "patient_note",
          "missed_explanation",
          "family_acknowledgment",
        ],
        required: true,
      },
      text: {
        type: String,
        trim: true,
        maxlength: 500,
        default: "",
      },
      authorId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      authorRole: {
        type: String,
        enum: [
          "patient",
          "family",
        ],
        required: true,
      },
      authorName: {
        type: String,
        trim: true,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: true,
    }
  );

const MedicationLogSchema =
  new Schema<IMedicationLogDocument>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      medicineId: {
        type: Schema.Types.ObjectId,
        ref: "Medicine",
        default: null,
      },
      medicineName: {
        type: String,
        required: true,
      },
      dosage: {
        type: String,
        default: "",
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
      outcomeRecordedAt: {
        type: Date,
        default: null,
      },
      takenAt: {
        type: Date,
        default: null,
      },
      status: {
        type: String,
        enum: [
          "pending",
          "dispensed",
          "taken",
          "missed",
          "late",
          "unverified",
          "incorrect_chamber",
          "reminder",
        ],
        default: "pending",
        index: true,
      },
      source: {
        type: String,
        enum: [
          "manual",
          "sensor",
          "system",
          "auto",
        ],
        default: "auto",
      },
      eventType: {
        type: String,
        enum: [
          "CHAMBER_OPENED",
          "MEDICATION_DISPENSED",
          "MEDICATION_CONFIRMED",
          "MISSED",
          "SCHEDULED",
        ],
        default: "SCHEDULED",
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
          validator: (
            values: number[]
          ) =>
            values.every(
              (value) =>
                Number.isInteger(
                  value
                ) &&
                value >= 1 &&
                value <= 4
            ),
          message:
            "Every expected chamber must be 1, 2, 3, or 4.",
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
        default: "",
        maxlength: 300,
      },
      sensorDeviceId: {
        type: String,
        default: null,
      },
      annotations: {
        type: [
          MedicationAnnotationSchema,
        ],
        default: [],
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
      medicineId: {
        $type: "objectId",
      },
    },
    name:
      "unique_medicine_dose_slot_per_day",
  }
);

const statusWrites =
  new WeakSet<object>();

MedicationLogSchema.pre(
  "findOneAndUpdate",
  function () {
    const update =
      this.getUpdate();

    if (
      update &&
      !Array.isArray(update) &&
      (
        typeof update.status ===
          "string" ||
        typeof update.$set?.status ===
          "string"
      )
    ) {
      statusWrites.add(this);
    }
  }
);

MedicationLogSchema.post(
  "findOneAndUpdate",
  async function (document) {
    if (
      !document ||
      !statusWrites.has(this)
    ) {
      return;
    }

    try {
      const {
        queueMedicationState,
      } = await import(
        "@/lib/pwa/medicationNotifications"
      );

      await queueMedicationState(
        document
      );
    } catch (error) {
      console.error(
        "[PWA medication status]",
        error
      );
    }
  }
);

MedicationLogSchema.pre(
  "save",
  function () {
    this.$locals.notifyPwa =
      this.isModified("status");
  }
);

MedicationLogSchema.post(
  "save",
  async function (document) {
    if (
      !document.$locals.notifyPwa
    ) {
      return;
    }

    try {
      const {
        queueMedicationState,
      } = await import(
        "@/lib/pwa/medicationNotifications"
      );

      await queueMedicationState(
        document
      );
    } catch (error) {
      console.error(
        "[PWA medication status]",
        error
      );
    }
  }
);

const MedicationLog:
  Model<IMedicationLogDocument> =
  mongoose.models.MedicationLog ||
  mongoose.model<IMedicationLogDocument>(
    "MedicationLog",
    MedicationLogSchema
  );

export default MedicationLog;