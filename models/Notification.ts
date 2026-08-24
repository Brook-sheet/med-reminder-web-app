import mongoose, {
  Document,
  Model,
  Schema,
} from "mongoose";

export type NotificationType =
  | "upcoming_reminder"
  | "due_alarm"
  | "intake_confirmed"
  | "medication_alert"
  | "critical_alert"
  | "adherence_alert"
  | "food_monitoring_ready"
  | "food_monitoring_alert"
  | "monitoring_request"
  | "monitoring_approved"
  | "monitoring_declined"
  | "monitoring_revoked"
  | "chat_request"
  | "chat_request_accepted"
  | "chat_request_declined"
  | "chat_message";

export type NotificationNavigationScreen =
  | "dashboard"
  | "alerts"
  | "monitoring"
  | "chats"
  | "history"
  | "medicines"
  | "adherence"
  | "settings"
  | "account"
  | "patient_dashboard";

export interface INotificationDocument
  extends Document {
  userId:
    mongoose.Types.ObjectId;

  type:
    NotificationType;

  title:
    string;

  message:
    string;

  screen?:
    NotificationNavigationScreen;

  url?:
    string;

  alertId?:
    mongoose.Types.ObjectId;

  medicineId?:
    mongoose.Types.ObjectId;

  medicineName?:
    string;

  patientId?:
    string;

  riskLevel?:
    | "Low"
    | "Moderate"
    | "High";

  adherenceRate?:
    number;

  monitoringRequestId?:
    mongoose.Types.ObjectId;

  chatRequestId?:
    mongoose.Types.ObjectId;

  conversationId?:
    mongoose.Types.ObjectId;

  messageId?:
    mongoose.Types.ObjectId;

  medicationLogId?:
    mongoose.Types.ObjectId;

  read:
    boolean;

  createdAt:
    Date;

  updatedAt:
    Date;
}

const NOTIFICATION_TYPES:
  NotificationType[] = [
    "upcoming_reminder",
    "due_alarm",
    "intake_confirmed",
    "medication_alert",
    "critical_alert",
    "adherence_alert",
    "food_monitoring_ready",
    "food_monitoring_alert",
    "monitoring_request",
    "monitoring_approved",
    "monitoring_declined",
    "monitoring_revoked",
    "chat_request",
    "chat_request_accepted",
    "chat_request_declined",
    "chat_message",
  ];

const NOTIFICATION_SCREENS:
  NotificationNavigationScreen[] =
  [
    "dashboard",
    "alerts",
    "monitoring",
    "chats",
    "history",
    "medicines",
    "adherence",
    "settings",
    "account",
    "patient_dashboard",
  ];

const NotificationSchema =
  new Schema<INotificationDocument>(
    {
      userId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          "User",

        required:
          true,

        index:
          true,
      },

      type: {
        type:
          String,

        enum:
          NOTIFICATION_TYPES,

        required:
          true,

        index:
          true,
      },

      title: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          150,
      },

      message: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          1500,
      },

      screen: {
        type:
          String,

        enum:
          NOTIFICATION_SCREENS,

        default:
          null,
      },

      url: {
        type:
          String,

        default:
          null,

        trim:
          true,

        maxlength:
          500,
      },

      alertId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          "Alert",

        default:
          null,
      },

      medicineId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          "Medicine",

        default:
          null,
      },

      medicineName: {
        type:
          String,

        default:
          null,

        trim:
          true,

        maxlength:
          200,
      },

      /*
       * Public Patient ID such as PT-ABC123.
       *
       * This is intentionally different from the MongoDB
       * userId and is used for monitored-patient navigation.
       */
      patientId: {
        type:
          String,

        default:
          null,

        trim:
          true,

        maxlength:
          100,
      },

      riskLevel: {
        type:
          String,

        enum: [
          "Low",
          "Moderate",
          "High",
        ],

        default:
          null,
      },

      adherenceRate: {
        type:
          Number,

        min:
          0,

        max:
          100,

        default:
          null,
      },

      monitoringRequestId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          "MonitoringRequest",

        default:
          null,
      },

      chatRequestId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          "ChatRequest",

        default:
          null,
      },

      conversationId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          "Conversation",

        default:
          null,
      },

      messageId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          "Message",

        default:
          null,
      },

      medicationLogId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          "MedicationLog",

        default:
          null,
      },

      read: {
        type:
          Boolean,

        default:
          false,

        index:
          true,
      },
    },
    {
      timestamps:
        true,
    }
  );

NotificationSchema.index({
  userId: 1,
  createdAt: -1,
});

NotificationSchema.index({
  userId: 1,
  read: 1,
  createdAt: -1,
});

NotificationSchema.index({
  userId: 1,
  type: 1,
  createdAt: -1,
});

NotificationSchema.index(
  {
    userId: 1,
    chatRequestId: 1,
    type: 1,
  },
  {
    sparse: true,
  }
);

NotificationSchema.index(
  {
    userId: 1,
    monitoringRequestId: 1,
    type: 1,
  },
  {
    sparse: true,
  }
);

NotificationSchema.index(
  {
    userId: 1,
    conversationId: 1,
    createdAt: -1,
  },
  {
    sparse: true,
  }
);

const Notification:
  Model<INotificationDocument> =
  mongoose.models
    .Notification ||
  mongoose.model<INotificationDocument>(
    "Notification",
    NotificationSchema
  );

export default Notification;