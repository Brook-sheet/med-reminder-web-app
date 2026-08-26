// lib/rxBoxUi.ts
export interface RxBoxUiLoadingItem {
  chamberId: number;
}

export function buildFourChamberRows<T extends RxBoxUiLoadingItem>(items: T[]): Array<T | null> {
  return [1, 2, 3, 4].map(
    (chamberId) =>
      items.find((item) => item.chamberId === chamberId) ?? null
  );
}

// ======================================================
// GENERALIZED CHAMBER ROW BUILDER
// ======================================================
//
// buildFourChamberRows() above is hardcoded to exactly 4
// rows (chamberId 1-4). That's correct for the normal,
// within-capacity case, but when capacity.exceeded is
// true, the server's proposedLoadingItems can include a
// chamberId of 5 or higher - and buildFourChamberRows()
// would silently drop that item from the UI with no
// error, making the overflow banner's "Required: N"
// number impossible to reconcile with the table below it.
//
// buildChamberRows() takes an explicit rowCount so the
// caller can size it to plan.capacity.required when
// capacity is exceeded, ensuring every proposed item -
// including whichever one doesn't fit - is actually shown.
// ======================================================

export function buildChamberRows<T extends RxBoxUiLoadingItem>(items: T[], rowCount: number): Array<T | null> {
  return Array.from({ length: Math.max(rowCount, 0) }, (_, i) => i + 1).map(
    (chamberId) =>
      items.find((item) => item.chamberId === chamberId) ?? null
  );
}