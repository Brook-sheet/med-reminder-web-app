import { Document } from 'mongoose';

export interface UserDoc extends Document {
  email: string;
  password: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  patientId: string;
  condition?: string;
  age?: number;
  onboardingCompleted: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  dataResetAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}