// lib/passwordPolicy.ts

/**
 * Mirrors the exact rules already enforced in app/api/auth/register/route.ts
 * and app/api/profile/update-password/route.ts, so the new reset-password
 * flow can't accidentally accept a weaker (or reject a valid) password
 * compared to the rest of the app. Kept as its own small module rather than
 * refactoring those existing routes, to avoid touching working code.
 */
export function validatePasswordStrength(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}