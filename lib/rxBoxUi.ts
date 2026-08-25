// lib/rxBoxUi.ts
export interface RxBoxUiLoadingItem {
  chamberId: number;
}

export function buildFourChamberRows<
  T extends RxBoxUiLoadingItem
>(
  items: T[]
): Array<T | null> {
  return [
    1,
    2,
    3,
    4,
  ].map(
    (chamberId) =>
      items.find(
        (item) =>
          item.chamberId ===
          chamberId
      ) ??
      null
  );
}