import { getRideTier, getTierLabel, RIDE_TIERS, type RideTier } from '@/hooks/useSubscription';

export const formatPlanName = (plan: string | null | undefined): string => {
  switch (plan) {
    case 'trial':
      return 'Free Trial';
    case 'active':
    case 'basic':
    case 'advanced':
      return 'Ride Ready Docs';
    case 'expired':
      return 'Expired';
    default:
      return 'Free Trial';
  }
};

export const formatPlanWithDescription = (plan: string | null | undefined): string => {
  switch (plan) {
    case 'trial':
      return 'Free Trial';
    case 'active':
    case 'basic':
    case 'advanced':
      return 'Active Plan';
    case 'expired':
      return 'Expired';
    default:
      return 'Free Trial';
  }
};

export const getPlanDescription = (plan: string | null | undefined): string => {
  return 'All-in-One Compliance & Operations';
};

export const formatTierName = (rideCount: number): string => {
  const tier = getRideTier(rideCount);
  return getTierLabel(tier);
};

export const getTierDescription = (tier: RideTier): string => {
  const t = RIDE_TIERS[tier];
  if (tier === 'enterprise') return `${t.min}+ rides`;
  return `${t.min}–${t.max} rides`;
};
