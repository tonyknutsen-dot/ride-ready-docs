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

// Product ID → tier reverse lookup
export const PRODUCT_TO_TIER: Record<string, RideTier> = {
  "prod_TzSQ7dF4G0dKJD": "starter",
  "prod_TzSQDJ4tk7rqMD": "operator",
  "prod_TzSQRtud9y5adH": "professional",
  "prod_TzSQUajo9gq5iY": "enterprise",
};
