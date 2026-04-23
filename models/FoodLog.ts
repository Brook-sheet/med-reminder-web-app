// models/FoodLog.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFoodLogDocument extends Document {
  userId: mongoose.Types.ObjectId;
  medicationLogId?: mongoose.Types.ObjectId;
  questionId: string;
  answer: string;
  score: number; // 0-3 (WHO-based scoring)
  timestamp: Date;
  createdAt: Date;
}

const FoodLogSchema = new Schema<IFoodLogDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    medicationLogId: { type: Schema.Types.ObjectId, ref: 'MedicationLog', default: null },
    questionId: { type: String, required: true },
    answer: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 3 },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

FoodLogSchema.index({ userId: 1, timestamp: -1 });

const FoodLog: Model<IFoodLogDocument> =
  mongoose.models.FoodLog ||
  mongoose.model<IFoodLogDocument>('FoodLog', FoodLogSchema);

export default FoodLog;