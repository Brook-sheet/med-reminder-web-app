
import mongoose, {
  Schema,
  Document,
  Model,
} from "mongoose";

import {
  getMedicationDateKey,
} from "@/lib/medicationTime";

export interface IMedicineChamberAssignment {
  scheduledTime: string;
  chamberIds: number[];
}

export interface IMedicineDocument extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  pillsPerDose: number;

  /**
   * Manual assignments for individual scheduled doses.
   *
   * Example:
   * [
   *   { scheduledTime: "8:00 AM", chamberIds: [1] },
   *   { scheduledTime: "8:00 PM", chamberIds: [3] }
   * ]
   *
   * Multiple tablets may be placed in one chamber.
   * A chamber must not be assigned to different
   * dispensing times in the same daily loading cycle.
   */
  chamberAssignments: IMedicineChamberAssignment[];

  /**
   * Legacy chamber assignment.
   * Preserved for compatibility with older records.
   */
  chamberId?: number | null;

  windowBeforeMinutes: number;
  windowAfterMinutes: number;
  lateAfterMinutes: number;
  notes: string;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChamberAssignmentSchema =
  new Schema<IMedicineChamberAssignment>(
    {
      scheduledTime: {
        type: String,
        required: true,
        trim: true,
      },

      chamberIds: {
        type: [Number],
        required: true,
        default: [],

        validate: {
          validator: (ids: number[]) =>
            Array.isArray(ids) &&
            ids.length > 0 &&
            ids.length <= 4 &&
            new Set(ids).size === ids.length &&
            ids.every(
              (id) =>
                Number.isInteger(id) &&
                id >= 1 &&
                id <= 4
            ),

          message:
            "Each scheduled dose must have unique chamber IDs from 1 to 4.",
        },
      },
    },
    {
      _id: false,
    }
  );

const MedicineSchema =
  new Schema<IMedicineDocument>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [
          true,
          "User ID is required",
        ],
        index: true,
      },

      name: {
        type: String,
        required: [
          true,
          "Medicine name is required",
        ],
        trim: true,
      },

      dosage: {
        type: String,
        required: [
          true,
          "Dosage is required",
        ],
        trim: true,
      },

      frequency: {
        type: String,
        required: [
          true,
          "Frequency is required",
        ],
        default: "Once daily",
      },

      scheduledTimes: {
        type: [String],
        required: [
          true,
          "At least one scheduled time is required",
        ],

        validate: {
          validator: (times: string[]) =>
            Array.isArray(times) &&
            times.length > 0,

          message:
            "At least one scheduled time is required",
        },
      },

      pillsPerDose: {
        type: Number,
        min: 1,
        max: 4,
        default: 1,
      },

      chamberAssignments: {
        type: [ChamberAssignmentSchema],
        default: [],
      },

      chamberId: {
        type: Number,
        min: 1,
        max: 4,
        default: null,
        index: true,
      },

      windowBeforeMinutes: {
        type: Number,
        min: 0,
        max: 720,
        default: 30,
      },

      windowAfterMinutes: {
        type: Number,
        min: 0,
        max: 720,
        default: 90,
      },

      lateAfterMinutes: {
        type: Number,
        min: 0,
        max: 720,
        default: 30,
      },

      notes: {
        type: String,
        default: "",
      },

      startDate: {
        type: String,
        default: () =>
          getMedicationDateKey(),
      },

      endDate: {
        type: String,
        default: null,
      },

      isActive: {
        type: Boolean,
        default: true,
      },
    },
    {
      timestamps: true,
    }
  );

const Medicine: Model<IMedicineDocument> =
  mongoose.models.Medicine ||
  mongoose.model<IMedicineDocument>(
    "Medicine",
    MedicineSchema
  );

export default Medicine;
