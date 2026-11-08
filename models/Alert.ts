import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

export type AlertEventType =
  | 'PREDICTED_ADHERENCE_RISK'
  | 'MEDICATION_LATE'
  | 'MEDICATION_MISSED'
  | 'MEDICATION_VERIFIED'
  | 'MEDICATION_EVENT_WARNING'
  | 'CRITICAL_MEDICATION_EVENT'
  | 'POSSIBLE_EXCESS_INTAKE';

export type AlertSeverity =
  | 'INFO'
  | 'NOTICE'
  | 'WARNING'
  | 'CRITICAL';

export type AlertStatus =
  | 'UNREAD'
  | 'READ'
  | 'ACKNOWLEDGED';

export type DeliveryStatus =
  | 'NOT_REQUESTED'
  | 'PENDING'
  | 'QUEUED'
  | 'SENT'
  | 'SKIPPED'
  | 'FAILED';

export interface IAlertDocument
  extends Document<mongoose.Types.ObjectId> {
  patientId: mongoose.Types.ObjectId;

  monitorId?:
    | mongoose.Types.ObjectId
    | null;

  medicationId?:
    | mongoose.Types.ObjectId
    | null;

  medicationLogId?:
    | mongoose.Types.ObjectId
    | null;

  eventKey: string;
  eventType: AlertEventType;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: AlertStatus;

  isRead: boolean;
  popupShown: boolean;
  popupShownAt?: Date | null;

  occurredAt: Date;
  readAt?: Date | null;
  acknowledgedAt?: Date | null;

  channels: {
    inApp: boolean;
    push: boolean;
    sms: boolean;
  };

  delivery: {
    pushStatus: DeliveryStatus;
    smsStatus: DeliveryStatus;
    pushError?: string;
    smsError?: string;
  };

  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema =
  new Schema<IAlertDocument>(
    {
      patientId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
      },

      monitorId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true,
      },

      medicationId: {
        type: Schema.Types.ObjectId,
        ref: 'Medicine',
        default: null,
      },

      medicationLogId: {
        type: Schema.Types.ObjectId,
        ref: 'MedicationLog',
        default: null,
      },

      eventKey: {
        type: String,
        required: true,
        trim: true,
      },

      eventType: {
        type: String,
        enum: [
          'PREDICTED_ADHERENCE_RISK',
          'MEDICATION_LATE',
          'MEDICATION_MISSED',
          'MEDICATION_VERIFIED',
          'MEDICATION_EVENT_WARNING',
          'CRITICAL_MEDICATION_EVENT',
          'POSSIBLE_EXCESS_INTAKE',
        ],
        required: true,
        index: true,
      },

      severity: {
        type: String,
        enum: [
          'INFO',
          'NOTICE',
          'WARNING',
          'CRITICAL',
        ],
        required: true,
        index: true,
      },

      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
      },

      message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 600,
      },

      status: {
        type: String,
        enum: [
          'UNREAD',
          'READ',
          'ACKNOWLEDGED',
        ],
        default: 'UNREAD',
        index: true,
      },

      isRead: {
        type: Boolean,
        default: false,
        index: true,
      },

      /*
       * Popup display is independent from reading.
       * These defaults are stored on new alerts.
       */
      popupShown: {
        type: Boolean,
        default: false,
      },

      popupShownAt: {
        type: Date,
        default: null,
      },

      occurredAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },

      readAt: {
        type: Date,
        default: null,
      },

      acknowledgedAt: {
        type: Date,
        default: null,
      },

      channels: {
        inApp: {
          type: Boolean,
          default: true,
        },

        push: {
          type: Boolean,
          default: false,
        },

        sms: {
          type: Boolean,
          default: false,
        },
      },

      delivery: {
        pushStatus: {
          type: String,
          enum: [
            'NOT_REQUESTED',
            'PENDING',
            'QUEUED',
            'SENT',
            'SKIPPED',
            'FAILED',
          ],
          default: 'NOT_REQUESTED',
        },

        smsStatus: {
          type: String,
          enum: [
            'NOT_REQUESTED',
            'PENDING',
            'QUEUED',
            'SENT',
            'SKIPPED',
            'FAILED',
          ],
          default: 'NOT_REQUESTED',
        },

        pushError: {
          type: String,
          default: '',
        },

        smsError: {
          type: String,
          default: '',
        },
      },

      metadata: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
    },
  );

AlertSchema.index({
  monitorId: 1,
  createdAt: -1,
});

AlertSchema.index({
  monitorId: 1,
  isRead: 1,
  createdAt: -1,
});

AlertSchema.index(
  {
    eventKey: 1,
    monitorId: 1,
  },
  {
    unique: true,
  },
);

const Alert: Model<IAlertDocument> =
  mongoose.models.Alert ||
  mongoose.model<IAlertDocument>(
    'Alert',
    AlertSchema,
  );

export default Alert;