import type { NextRequest } from "next/server";

// Applies only to lazy maintenance in page GET requests.
// Authentication still runs normally. Cron and hardware endpoints
// do not use this hint.
export function isProductTourReadOnly(
  request: NextRequest,
  userId: string,
): boolean {
  return request.cookies.get("rx_product_tour")?.value === userId;
}