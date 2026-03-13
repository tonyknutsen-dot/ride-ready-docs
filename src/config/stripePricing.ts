/**
 * Single source of truth for all Stripe pricing configuration.
 * 
 * Both frontend components and edge functions reference these IDs.
 * When changing pricing in Stripe, update ONLY this file.
 */

// ── Ride-based pricing tiers ────────────────────────────────────────────────

export const RIDE_TIERS = {
  starter: { min: 1, max: 5, monthly: 9.99, label: 'Starter' },
  operator: { min: 6, max: 12, monthly: 19.99, label: 'Operator' },
  professional: { min: 13, max: 25, monthly: 34.99, label: 'Professional' },
  business: { min: 26, max: 50, monthly: 44.99, label: 'Business' },
} as const;

/** Items above this count require a custom/contact plan */
export const SELF_SERVE_MAX = 50;

export type RideTier = keyof typeof RIDE_TIERS;

// ── Stripe Price IDs (one per tier, monthly only) ───────────────────────────

export const STRIPE_PRICE_IDS: Record<RideTier, string> = {
  starter: "price_1T1TVLAG8uIRefcZ1nMRWRVV",
  operator: "price_1T1TVMAG8uIRefcZKyL8XcLz",
  professional: "price_1T1TVNAG8uIRefcZviQXUgrA",
  business: "price_1T1TVOAG8uIRefcZKAcqeqNw",
};

// ── Stripe Product IDs ──────────────────────────────────────────────────────

export const STRIPE_PRODUCT_IDS: Record<RideTier, string> = {
  starter: "prod_TzSQ7dF4G0dKJD",
  operator: "prod_TzSQDJ4tk7rqMD",
  professional: "prod_TzSQRtud9y5adH",
  business: "prod_TzSQUajo9gq5iY",
};

// ── Product ID → tier reverse lookup ────────────────────────────────────────

export const PRODUCT_TO_TIER: Record<string, RideTier> = {
  [STRIPE_PRODUCT_IDS.starter]: "starter",
  [STRIPE_PRODUCT_IDS.operator]: "operator",
  [STRIPE_PRODUCT_IDS.professional]: "professional",
  [STRIPE_PRODUCT_IDS.business]: "business",
};

// ── Tier helpers ────────────────────────────────────────────────────────────

export const getRideTier = (billableRideCount: number): RideTier => {
  if (billableRideCount <= 5) return 'starter';
  if (billableRideCount <= 12) return 'operator';
  if (billableRideCount <= 25) return 'professional';
  return 'enterprise';
};

export const getTierPrice = (tier: RideTier): number => RIDE_TIERS[tier].monthly;

export const getTierLabel = (tier: RideTier): string => RIDE_TIERS[tier].label;

export const getTierForRideCount = (count: number) => {
  const tier = getRideTier(count);
  return { tier, ...RIDE_TIERS[tier] };
};
