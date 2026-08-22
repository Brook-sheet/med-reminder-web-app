export interface AuthPayload {
  userId: string;
  email: string;
  emailVerified: true;
  iat?: number;
  exp?: number;
}
