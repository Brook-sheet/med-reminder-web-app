import { Document } from 'mongoose';

export interface UserDoc extends Document {
  email: string;
  password?: string;
  emailVerified: boolean;
  googleSubject?: string;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
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