import mongoose, {
  Schema,
  Document,
  Model,
} from 'mongoose';

export interface INotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  type:
    | 'upcoming_reminder'
    | 'due_alarm'
    | 'intake_confirmed'
    | 'adherence_alert'
    | 'monitoring_request'
    | 'monitoring_approved'
    | 'monitoring_declined'
    | 'monitoring_revoked'
    | 'chat_request'
    | 'chat_request_accepted'
    | 'chat_request_declined';
  title: string;
  message: string;
  medicineId?: mongoose.Types.ObjectId;
  medicineName?: string;
  riskLevel?: 'Low' | 'Moderate' | 'High';
  adherenceRate?: number;
  monitoringRequestId?: mongoose.Types.ObjectId;
  chatRequestId?: mongoose.Types.ObjectId;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema =
  new Schema<INotificationDocument>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
      },
      type: {
        type: String,
        enum: [
          'upcoming_reminder',
          'due_alarm',
          'intake_confirmed',
          'adherence_alert',
          'monitoring_request',
          'monitoring_approved',
          'monitoring_declined',
          'monitoring_revoked',
          'chat_request',
          'chat_request_accepted',
          'chat_request_declined',
        ],
        required: true,
      },
      title: {
        type: String,
        required: true,
      },
      message: {
        type: String,
        required: true,
      },
      medicineId: {
        type: Schema.Types.ObjectId,
        ref: 'Medicine',
        default: null,
      },
      medicineName: {
        type: String,
        default: null,
      },
      riskLevel: {
        type: String,
        enum: ['Low', 'Moderate', 'High'],
        default: null,
      },
      adherenceRate: {
        type: Number,
        default: null,
      },
      monitoringRequestId: {
        type: Schema.Types.ObjectId,
        ref: 'MonitoringRequest',
        default: null,
      },
      chatRequestId: {
        type: Schema.Types.ObjectId,
        ref: 'ChatRequest',
        default: null,
      },
      read: {
        type: Boolean,
        default: false,
      },
    },
    {
      timestamps: true,
    }
  );

NotificationSchema.index({
  userId: 1,
  createdAt: -1,
});

const Notification: Model<INotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<INotificationDocument>(
    'Notification',
    NotificationSchema
  );

export default Notification;