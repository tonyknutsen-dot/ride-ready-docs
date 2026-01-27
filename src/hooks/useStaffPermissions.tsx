import { useStaff } from '@/contexts/StaffContext';
import { Database } from '@/integrations/supabase/types';

type StaffPermission = Database['public']['Enums']['staff_permission'];

export function useStaffPermissions() {
  const staff = useStaff();

  const hasPermission = (required: StaffPermission | StaffPermission[]): boolean => {
    // Owners have all permissions
    if (staff.isOwner && !staff.isStaff) {
      return true;
    }

    // If not staff and not owner, no permissions
    if (!staff.permissionLevel) {
      return false;
    }

    const requiredPermissions = Array.isArray(required) ? required : [required];
    
    // Permission hierarchy: full_access > checks_maintenance > checks_only
    const permissionHierarchy: Record<StaffPermission, number> = {
      'checks_only': 1,
      'checks_maintenance': 2,
      'full_access': 3,
    };

    const userLevel = permissionHierarchy[staff.permissionLevel];

    return requiredPermissions.some(perm => {
      const requiredLevel = permissionHierarchy[perm];
      return userLevel >= requiredLevel;
    });
  };

  const getPermissionLabel = (permission: StaffPermission): string => {
    const labels: Record<StaffPermission, string> = {
      'checks_only': 'Checks Only',
      'checks_maintenance': 'Checks & Maintenance',
      'full_access': 'Full Access',
    };
    return labels[permission];
  };

  const getPermissionDescription = (permission: StaffPermission): string => {
    const descriptions: Record<StaffPermission, string> = {
      'checks_only': 'Can perform pre-opening, daily, monthly, and yearly checks',
      'checks_maintenance': 'Can perform checks and log maintenance activities',
      'full_access': 'Can access checks, maintenance, documents, and risk assessments',
    };
    return descriptions[permission];
  };

  return {
    ...staff,
    hasPermission,
    getPermissionLabel,
    getPermissionDescription,
  };
}
