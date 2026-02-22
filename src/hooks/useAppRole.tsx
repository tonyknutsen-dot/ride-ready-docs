import { useStaff } from '@/contexts/StaffContext';
import { AppRole } from '@/utils/permissions';

/**
 * Returns the current user's AppRole based on StaffContext.
 * - Owner (not staff) → 'controller'
 * - Staff member → mapped from permission_level enum
 */
export function useAppRole(): AppRole {
  const { isOwner, isStaff, permissionLevel } = useStaff();

  if (isOwner && !isStaff) return 'controller';
  if (isStaff && permissionLevel) return permissionLevel as AppRole;

  // Fallback: if user is owner with org membership, still controller
  if (isOwner) return 'controller';

  // Default for unknown state
  return 'staff';
}
