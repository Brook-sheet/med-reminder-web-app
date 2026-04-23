// models/Notification.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'upcoming_reminder' | 'due_alarm' | 'intake_confirmed' | 'adherence_alert';
  title: string;
  message: string;
  medicineId?: mongoose.Types.ObjectId;
  medicineName?: string;
  riskLevel?: 'Low' | 'Moderate' | 'High';
  adherenceRate?: number;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['upcoming_reminder', 'due_alarm', 'intake_confirmed', 'adherence_alert'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', default: null },
    medicineName: { type: String, default: null },
    riskLevel: { type: String, enum: ['Low', 'Moderate', 'High'], default: null },
    adherenceRate: { type: Number, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

const Notification: Model<INotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<INotificationDocument>('Notification', NotificationSchema);

export default Notification;