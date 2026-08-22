export interface AuthPayload {
  userId: string;
  email: string;
  emailVerified: true;
  role: 'patient' | 'family';
  iat?: number;
  exp?: number;
}