import mongoose, {
  Schema,
} from "mongoose";

import type {
  NotificationPayload,
} from "@/lib/notificationChannels";

interface PwaDeliveryDocument {
  eventKey: string;
  userId: mongoose.Types.ObjectId;
  patientId?: mongoose.Types.ObjectId;
  payload: NotificationPayload;
  status:
    | "pending"
    | "sent"
    | "skipped";
  attempts: number;
  nextAttemptAt: Date;
  leaseUntil: Date;
  expiresAt: Date;
}

const schema =
  new Schema<PwaDeliveryDocument>(
    {
      eventKey: {
        type: String,
        required: true,
        unique: true,
      },
      userId: {
        type: Schema.Types.ObjectId,
        required: true,
        index: true,
      },
      patientId: {
        type: Schema.Types.ObjectId,
      },
      payload: {
        type: Schema.Types.Mixed,
        required: true,
      },
      status: {
        type: String,
        enum: [
          "pending",
          "sent",
          "skipped",
        ],
        default: "pending",
      },
      attempts: {
        type: Number,
        default: 0,
      },
      nextAttemptAt: {
        type: Date,
        default: Date.now,
      },
      leaseUntil: {
        type: Date,
        default: () =>
          new Date(0),
      },
      expiresAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
    }
  );

schema.index({
  status: 1,
  nextAttemptAt: 1,
  leaseUntil: 1,
});

/*
 * Successful event keys are retained
 * to prevent later log edits from
 * sending the same event again.
 */
const PwaDelivery =
  (
    mongoose.models
      .PwaDelivery as mongoose.Model<PwaDeliveryDocument>
  ) ||
  mongoose.model<PwaDeliveryDocument>(
    "PwaDelivery",
    schema
  );

export default PwaDelivery;