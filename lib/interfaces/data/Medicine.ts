export interface Medicine {
  _id?: string;
  userId: string;
  name: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  color?: string;
  notes?: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
 