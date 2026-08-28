import mongoose, {
  Document,
  Schema,
} from "mongoose";

export interface IUser
  extends Document {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password?: string;
  emailVerified: boolean;
  googleSubject?: string;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
  role: "patient" | "family";
  age?: number;
  condition?: string;
  onboardingCompleted: boolean;
  patientId?: string;
  familyId?: string;
  monitoredPatients: string[];
  authorizedMonitors: string[];
  isDeleted?: boolean;
  dataResetAt?: Date;
  lastRiskLevel?: string;

  notificationPreferences?: {
    inApp: boolean;
    push: boolean;
    sms: boolean;
    smsConsent: boolean;
    smsConsentAt?: Date | null;
    smsPhoneNumber?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const UserSchema =
  new Schema<IUser>(
    {
      firstName: {
        type: String,
        default: "",
        trim: true,
      },

      middleName: {
        type: String,
        default: "",
        trim: true,
      },

      lastName: {
        type: String,
        default: "",
        trim: true,
      },

      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },

      password: {
        type: String,
      },

      emailVerified: {
        type: Boolean,
        default: false,
        index: true,
      },

      googleSubject: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        select: false,
      },

      emailVerificationTokenHash: {
        type: String,
        select: false,
        index: true,
      },

      emailVerificationExpires: {
        type: Date,
        select: false,
      },

      role: {
        type: String,
        enum: [
          "patient",
          "family",
        ],
        required: true,
        default: "patient",
        index: true,
      },

      age: {
        type: Number,
      },

      condition: {
        type: String,
        enum: [
          "Diabetes",
          "Hypertension",
          "Both",
          "Other",
          "None",
        ],
        required: false,
      },

      onboardingCompleted: {
        type: Boolean,
        default: false,
      },

      patientId: {
        type: String,
        unique: true,
        sparse: true,
      },

      familyId: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
      },

      monitoredPatients: {
        type: [String],
        default: [],
      },

      authorizedMonitors: {
        type: [String],
        default: [],
      },

      isDeleted: {
        type: Boolean,
        default: false,
      },

      dataResetAt: {
        type: Date,
        default: null,
      },

      lastRiskLevel: {
        type: String,
        enum: [
          "Low",
          "Moderate",
          "High",
        ],
        default: null,
      },

      notificationPreferences: {
        inApp: {
          type: Boolean,
          default: true,
        },

        push: {
          type: Boolean,
          default: true,
        },

        sms: {
          type: Boolean,
          default: false,
        },

        smsConsent: {
          type: Boolean,
          default: false,
        },

        smsConsentAt: {
          type: Date,
          default: null,
        },

        smsPhoneNumber: {
          type: String,
          default: "",
          trim: true,
          select: false,
        },
      },
    },
    {
      timestamps: true,
    }
  );

export default
  mongoose.models.User ||
  mongoose.model<IUser>(
    "User",
    UserSchema
  );