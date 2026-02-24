import { useStaff } from '@/contexts/StaffContext';
import { AppRole } from '@/utils/permissions';

/**
 * Returns the current user's AppRole based on StaffContext.
 * - Owner (not staff) → 'controller'
 * - Staff member → 'staff'
 */
export function useAppRole(): AppRole {
  const { isOwner, isStaff } = useStaff();

  if (isOwner && !isStaff) return 'controller';
  if (isStaff) return 'staff';

  // Fallback: if user is owner with org membership, still controller
  if (isOwner) return 'controller';

  // Default for unknown state
  return 'staff';
}
