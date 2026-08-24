import mongoose, {
  Document,
  Model,
  Schema,
} from "mongoose";

export type MedicationReminderType =
  | "upcoming_reminder"
  | "due_alarm";

export type MedicationReminderDeliveryStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed";

export interface IMedicationReminderDeliveryDocument
  extends Document<mongoose.Types.ObjectId> {
  _id: mongoose.Types.ObjectId;

  dedupeKey: string;

  userId: mongoose.Types.ObjectId;

  medicationLogId: mongoose.Types.ObjectId;

  medicineId?: mongoose.Types.ObjectId | null;

  notificationId?: mongoose.Types.ObjectId | null;

  reminderType: MedicationReminderType;

  scheduledDate: string;

  scheduledTime: string;

  scheduledFor: Date;

  status: MedicationReminderDeliveryStatus;

  attemptCount: number;

  claimedAt?: Date | null;

  lastAttemptAt?: Date | null;

  nextAttemptAt: Date;

  deliveredAt?: Date | null;

  lastError?: string;

  expireAt: Date;

  createdAt: Date;

  updatedAt: Date;
}

const MedicationReminderDeliverySchema =
  new Schema<IMedicationReminderDeliveryDocument>(
    {
      dedupeKey: {
        type: String,
        required: true,
        unique: true,
        trim: true,
      },

      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      medicationLogId: {
        type: Schema.Types.ObjectId,
        ref: "MedicationLog",
        required: true,
        index: true,
      },

      medicineId: {
        type: Schema.Types.ObjectId,
        ref: "Medicine",
        default: null,
      },

      notificationId: {
        type: Schema.Types.ObjectId,
        ref: "Notification",
        default: null,
      },

      reminderType: {
        type: String,
        enum: [
          "upcoming_reminder",
          "due_alarm",
        ],
        required: true,
        index: true,
      },

      scheduledDate: {
        type: String,
        required: true,
      },

      scheduledTime: {
        type: String,
        required: true,
      },

      scheduledFor: {
        type: Date,
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "processing",
          "sent",
          "failed",
        ],
        default: "pending",
        required: true,
        index: true,
      },

      attemptCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      claimedAt: {
        type: Date,
        default: null,
      },

      lastAttemptAt: {
        type: Date,
        default: null,
      },

      nextAttemptAt: {
        type: Date,
        default: Date.now,
        required: true,
        index: true,
      },

      deliveredAt: {
        type: Date,
        default: null,
      },

      lastError: {
        type: String,
        default: "",
        maxlength: 500,
      },

      expireAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
    }
  );

MedicationReminderDeliverySchema.index(
  {
    status: 1,
    nextAttemptAt: 1,
  }
);

MedicationReminderDeliverySchema.index(
  {
    userId: 1,
    scheduledFor: -1,
  }
);

MedicationReminderDeliverySchema.index(
  {
    medicationLogId: 1,
    reminderType: 1,
  }
);

MedicationReminderDeliverySchema.index(
  {
    expireAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

const MedicationReminderDelivery:
  Model<IMedicationReminderDeliveryDocument> =
  mongoose.models
    .MedicationReminderDelivery ||
  mongoose.model<IMedicationReminderDeliveryDocument>(
    "MedicationReminderDelivery",
    MedicationReminderDeliverySchema
  );

export default MedicationReminderDelivery;