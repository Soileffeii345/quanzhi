// Records shown in public historical-price data must represent completed sales
// whose box number has passed the strongest available verification step.
export const PUBLISHED_SALE_STATUSES = [
  "verified",
  "image_exact",
  // Transaction page confirmed image, price and time; official grading lookup
  // may still be temporarily unavailable or rate-limited.
  "official_pending",
  "youbao_trade",
];

export const ACTIVE_LISTING_STATUSES = ["active_listing", "youbao_active"];

export function sqlIn(values) {
  return values.map((value) => `'${value}'`).join(", ");
}
