/**
 * Shared physical chamber configuration.
 * Safe to import in both browser and server code.
 */
export const RX_BOX_CAPACITY = 5;

export const RX_BOX_CHAMBER_IDS: readonly number[] =
  Object.freeze(
    Array.from(
      { length: RX_BOX_CAPACITY },
      (_, index) => index + 1
    )
  );

export function isValidRxBoxChamberId(
  value: number
): boolean {
  return (
    Number.isInteger(value) &&
    value >= 1 &&
    value <= RX_BOX_CAPACITY
  );
}