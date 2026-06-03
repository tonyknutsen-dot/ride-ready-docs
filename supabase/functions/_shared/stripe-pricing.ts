/**
 * Shared Stripe pricing config for edge functions.
 * Mirrors src/config/stripePricing.ts — keep in sync.
 *
 * We duplicate rather than import from src/ because Deno edge functions
 * cannot import from the Vite/React source tree.
 */

export type RideTier = 'starter' | 'operator' | 'professional' | 'business';

/** Items above this count require a custom/contact plan */
export const SELF_SERVE_MAX = 50;

// Price IDs (one per tier, monthly)
export const TIER_PRICE_IDS: Record<RideTier, string> = {
  starter: "price_1TSaveAsl8xleyvDADCNwAr5",
  operator: "price_1TSavZAsl8xleyvDgsz1qow1",
  professional: "price_1TSavVAsl8xleyvDGbxKtlm7",
  business: "price_1TSavNAsl8xleyvDmdB4GfGn",
};

// Product ID → tier reverse lookup
export const PRODUCT_TO_TIER: Record<string, RideTier> = {
  "prod_TzSQ7dF4G0dKJD": "starter",
  "prod_TzSQDJ4tk7rqMD": "operator",
  "prod_TzSQRtud9y5adH": "professional",
  "prod_TzSQUajo9gq5iY": "business",
};
