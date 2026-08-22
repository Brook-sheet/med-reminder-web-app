export interface User {
  _id?: string;
  email: string;
  password?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  role: "patient" | "family";
  patientId?: string;
  familyId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}