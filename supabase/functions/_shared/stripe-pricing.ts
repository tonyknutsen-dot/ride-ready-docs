/**
 * Shared Stripe pricing config for edge functions.
 * Mirrors src/config/stripePricing.ts — keep in sync.
 *
 * We duplicate rather than import from src/ because Deno edge functions
 * cannot import from the Vite/React source tree.
 */

export type RideTier = 'starter' | 'operator' | 'professional' | 'enterprise';

// Price IDs (one per tier, monthly)
export const TIER_PRICE_IDS: Record<RideTier, string> = {
  starter: "price_1T1TVLAG8uIRefcZ1nMRWRVV",
  operator: "price_1T1TVMAG8uIRefcZKyL8XcLz",
  professional: "price_1T1TVNAG8uIRefcZviQXUgrA",
  enterprise: "price_1T1TVOAG8uIRefcZKAcqeqNw",
};

// Product ID → tier reverse lookup (includes legacy products)
export const PRODUCT_TO_TIER: Record<string, RideTier> = {
  // Current products
  "prod_TzSQ7dF4G0dKJD": "starter",
  "prod_TzSQDJ4tk7rqMD": "operator",
  "prod_TzSQRtud9y5adH": "professional",
  "prod_TzSQUajo9gq5iY": "enterprise",
  // Legacy products (kept for existing subscribers)
  "prod_TlWvelEK6GafPH": "starter",
  "prod_TlWvGM8f7f2mRa": "starter",
  "prod_TlWvaItiHUq1PZ": "operator",
  "prod_TlWv8lD3Q4BCIX": "operator",
  "prod_SXfMmvFhJCpgPz": "starter",
  "prod_SXfOT7Wm2qkLzI": "starter",
  "prod_SXfOIqB5fXfmOi": "operator",
  "prod_SXfPx1nMO9nxbA": "operator",
};
