// lib/validations.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared client-side validation helpers used across all forms.
// Import and call these BEFORE submitting any form data to the server.
// ─────────────────────────────────────────────────────────────────────────────

/** Regex: letters (including accented/international), spaces, hyphens, apostrophes only */
const NAME_REGEX = /^[a-zA-ZÀ-ÖØ-öø-ÿ\s'\-]+$/;

/**
 * Validates that a name field contains only valid characters.
 * Accepts: letters (including accented), spaces, hyphens, apostrophes.
 * Rejects: numbers, special characters like @, #, <, >, etc.
 */
export function validateName(value: string, label = "Name"): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (!NAME_REGEX.test(trimmed)) {
    return `${label} must contain letters only (no numbers or special characters).`;
  }
  if (trimmed.length < 2) {
    return `${label} must be at least 2 characters.`;
  }
  if (trimmed.length > 50) {
    return `${label} must not exceed 50 characters.`;
  }
  return null; // null means valid
}

/**
 * Validates an optional name field — only checks format if a value is given.
 */
export function validateOptionalName(value: string, label = "Name"): string | null {
  if (!value || !value.trim()) return null; // optional, blank is fine
  return validateName(value, label);
}

/**
 * Validates an email address format.
 */
export function validateEmail(value: string): string | null {
  if (!value.trim()) return "Email is required.";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value.trim())) return "Please enter a valid email address.";
  return null;
}

/**
 * Validates a password — at least 6 characters.
 */
export function validatePassword(value: string): string | null {
  if (!value) return "Password is required.";
  if (value.length < 6) return "Password must be at least 6 characters.";
  return null;
}

/**
 * Validates that two passwords match.
 */
export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) return "Please confirm your password.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}

/**
 * Validates an age field — must be a number between 1 and 120.
 */
export function validateAge(value: string | number): string | null {
  const num = Number(value);
  if (!value && value !== 0) return null; // age is optional in profile
  if (isNaN(num) || num <= 0 || num > 120) {
    return "Please enter a valid age (1–120).";
  }
  return null;
}

/**
 * Collect all errors from a validation map into a single error string,
 * or return null if everything is valid.
 *
 * Usage:
 *   const error = collectErrors({
 *     firstName: validateName(firstName, "First Name"),
 *     email: validateEmail(email),
 *   });
 *   if (error) { setError(error); return; }
 */
export function collectErrors(validations: Record<string, string | null>): string | null {
  for (const msg of Object.values(validations)) {
    if (msg !== null) return msg;
  }
  return null;
}