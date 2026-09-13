export type AccountIdPrefix = "FM-" | "PT-";

/**
 * Removes the account prefix for copying.
 * Does not change the stored account identifier.
 */
export function accountIdSuffix(identifier: string): string {
  return identifier.trim().replace(/^(?:FM|PT)-/i, "");
}

/**
 * Accepts a suffix or a pasted matching full ID.
 * A different role's prefix is preserved so validation rejects it.
 */
export function normalizeAccountIdInput(
  value: string,
  prefix: AccountIdPrefix
): string {
  const normalized = value.trim().toUpperCase();

  return normalized.startsWith(prefix)
    ? normalized.slice(prefix.length)
    : normalized;
}

/**
 * Reconstructs the complete identifier required by the existing APIs.
 */
export function buildAccountIdentifier(
  value: string,
  prefix: AccountIdPrefix
): string {
  const suffix = normalizeAccountIdInput(value, prefix);

  return suffix ? `${prefix}${suffix}` : "";
}