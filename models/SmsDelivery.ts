import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

import type {
  SmsAlertType,
  SmsProvider,
} from '@/lib/sms/types';

export type SmsDeliveryStatus =
  | 'processing'
  | 'queued'
  | 'sent'
  | 'skipped'
  | 'failed';

export interface ISmsDeliveryDocument
  extends Document<
    mongoose.Types.ObjectId
  > {
  dedupeKey: string;

  recipientId:
    mongoose.Types.ObjectId;

  patientId?:
    | mongoose.Types.ObjectId
    | null;

  alertId?:
    | mongoose.Types.ObjectId
    | null;

  alertType:
    SmsAlertType;

  provider:
    SmsProvider;

  status:
    SmsDeliveryStatus;

  maskedPhone:
    string;

  providerMessageId?:
    string;

  errorCode?:
    string;

  errorMessage?:
    string;

  createdAt: Date;
  updatedAt: Date;
}

const SmsDeliverySchema =
  new Schema<
    ISmsDeliveryDocument
  >(
    {
      dedupeKey: {
        type:
          String,

        required:
          true,

        unique:
          true,

        trim:
          true,

        maxlength:
          300,
      },

      recipientId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

      patientId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          'User',

        default:
          null,

        index:
          true,
      },

      alertId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          'Alert',

        default:
          null,
      },

      alertType: {
        type:
          String,

        required:
          true,

        enum: [
          'MEDICATION_VERIFIED',
          'MEDICATION_LATE',
          'MEDICATION_MISSED',
          'CRITICAL_MEDICATION_EVENT',
          'TEST_SMS',
          'OTHER',
        ],

        index:
          true,
      },

      provider: {
        type:
          String,

        required:
          true,

        enum: [
          'textbee',
          'twilio',
          'disabled',
        ],
      },

      status: {
        type:
          String,

        required:
          true,

        enum: [
          'processing',
          'queued',
          'sent',
          'skipped',
          'failed',
        ],

        default:
          'processing',

        index:
          true,
      },

      maskedPhone: {
        type:
          String,

        default:
          '',

        maxlength:
          40,
      },

      providerMessageId: {
        type:
          String,

        default:
          '',

        maxlength:
          200,
      },

      errorCode: {
        type:
          String,

        default:
          '',

        maxlength:
          100,
      },

      errorMessage: {
        type:
          String,

        default:
          '',

        maxlength:
          300,
      },
    },
    {
      timestamps:
        true,
    }
  );

SmsDeliverySchema.index({
  recipientId:
    1,

  createdAt:
    -1,
});

const SmsDelivery:
  Model<
    ISmsDeliveryDocument
  > =
  mongoose.models
    .SmsDelivery ||
  mongoose.model<
    ISmsDeliveryDocument
  >(
    'SmsDelivery',
    SmsDeliverySchema
  );

export default
  SmsDelivery;