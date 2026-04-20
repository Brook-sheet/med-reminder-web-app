import { Document } from 'mongoose';

export interface UserDoc extends Document {
  email: string;
  password: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  patientId: string;
  createdAt: Date;
  updatedAt: Date;
}
