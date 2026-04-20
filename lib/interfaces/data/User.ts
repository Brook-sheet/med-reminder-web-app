export interface User {
  _id?: string;
  email: string;
  password?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  patientId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
