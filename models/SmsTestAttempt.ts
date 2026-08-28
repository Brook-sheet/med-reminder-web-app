import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

export interface ISmsTestAttemptDocument
  extends Document<
    mongoose.Types.ObjectId
  > {
  userId:
    mongoose.Types.ObjectId;

  minuteBucket:
    string;

  createdAt:
    Date;
}

const SmsTestAttemptSchema =
  new Schema<
    ISmsTestAttemptDocument
  >(
    {
      userId: {
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

      minuteBucket: {
        type:
          String,

        required:
          true,
      },
    },
    {
      timestamps: {
        createdAt:
          true,

        updatedAt:
          false,
      },
    }
  );

SmsTestAttemptSchema.index(
  {
    userId:
      1,

    minuteBucket:
      1,
  },
  {
    unique:
      true,
  }
);

SmsTestAttemptSchema.index(
  {
    createdAt:
      1,
  },
  {
    expireAfterSeconds:
      2 *
      24 *
      60 *
      60,
  }
);

const SmsTestAttempt:
  Model<
    ISmsTestAttemptDocument
  > =
  mongoose.models
    .SmsTestAttempt ||
  mongoose.model<
    ISmsTestAttemptDocument
  >(
    'SmsTestAttempt',
    SmsTestAttemptSchema
  );

export default
  SmsTestAttempt;