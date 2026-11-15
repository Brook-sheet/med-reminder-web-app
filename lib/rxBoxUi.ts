import { RX_BOX_CAPACITY } from "./rxBoxConfig";

export interface RxBoxUiLoadingItem {
  chamberId: number;
}

export function buildChamberRows<T extends RxBoxUiLoadingItem>(
  items: T[],
  rowCount: number = RX_BOX_CAPACITY
): Array<T | null> {
  return Array.from({ length: Math.max(rowCount, 0) }, (_, i) => i + 1).map(
    (chamberId) => items.find((item) => item.chamberId === chamberId) ?? null
  );
}

/** @deprecated Use buildChamberRows. Retained for existing imports. */
export function buildFourChamberRows<T extends RxBoxUiLoadingItem>(items: T[]): Array<T | null> {
  return buildChamberRows(items);
}