import mongoose, {
  Document,
  Model,
  Schema,
} from "mongoose";

export type ExpoPushPlatform =
  | "android"
  | "ios";

export interface IExpoPushTokenDocument
  extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  deviceId: string;
  platform: ExpoPushPlatform;
  appVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpoPushTokenSchema =
  new Schema<IExpoPushTokenDocument>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      token: {
        type: String,
        required: true,
        unique: true,
        trim: true,
      },
      deviceId: {
        type: String,
        required: true,
        trim: true,
      },
      platform: {
        type: String,
        enum: [
          "android",
          "ios",
        ],
        required: true,
      },
      appVersion: {
        type: String,
        default: null,
        trim: true,
      },
    },
    {
      timestamps: true,
    }
  );

ExpoPushTokenSchema.index(
  {
    userId: 1,
    deviceId: 1,
  },
  {
    unique: true,
  }
);

const ExpoPushToken: Model<IExpoPushTokenDocument> =
  mongoose.models
    .ExpoPushToken ||
  mongoose.model<IExpoPushTokenDocument>(
    "ExpoPushToken",
    ExpoPushTokenSchema
  );

export default ExpoPushToken;