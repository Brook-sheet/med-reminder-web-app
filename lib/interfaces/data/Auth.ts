export interface AuthPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}
