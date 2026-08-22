import mongoose, { Document, Model, Schema } from 'mongoose';

export type MonitoringStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'revoked';

export interface IMonitoringRequest extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  familyId: mongoose.Types.ObjectId;
  status: MonitoringStatus;
  respondedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MonitoringRequestSchema = new Schema<IMonitoringRequest>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined', 'revoked'],
      required: true,
      default: 'pending',
      index: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

MonitoringRequestSchema.index(
  {
    patientId: 1,
    familyId: 1,
  },
  {
    unique: true,
  }
);

MonitoringRequestSchema.index({
  patientId: 1,
  status: 1,
  createdAt: -1,
});

MonitoringRequestSchema.index({
  familyId: 1,
  status: 1,
  createdAt: -1,
});

const MonitoringRequest: Model<IMonitoringRequest> =
  mongoose.models.MonitoringRequest ||
  mongoose.model<IMonitoringRequest>(
    'MonitoringRequest',
    MonitoringRequestSchema
  );

export default MonitoringRequest;