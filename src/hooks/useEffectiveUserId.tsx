import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';

/**
 * Returns the effective user ID for data fetching.
 * - For owners: returns their own user ID
 * - For staff: returns the organization owner's ID
 * 
 * This ensures staff members see company data (owned by the org owner)
 * rather than their own empty data set.
 */
export function useEffectiveUserId() {
  const { user } = useAuth();
  const { isStaff, staffMembership, loading: staffLoading } = useStaff();

  // For staff, use the org owner's ID; for owners/regular users, use their own ID
  const effectiveUserId = isStaff && staffMembership?.ownerId 
    ? staffMembership.ownerId 
    : user?.id || null;

  return {
    effectiveUserId,
    isStaff,
    loading: staffLoading,
    // The actual logged-in user (for audit/ownership purposes)
    actualUserId: user?.id || null,
  };
}
