import { useStaff } from '@/contexts/StaffContext';
import { Database } from '@/integrations/supabase/types';

type StaffRole = Database['public']['Enums']['staff_role'];

export function useStaffPermissions() {
  const staff = useStaff();

  const hasPermission = (required: StaffRole | StaffRole[]): boolean => {
    // Owners have all permissions
    if (staff.isOwner && !staff.isStaff) {
      return true;
    }

    // If not staff and not owner, no permissions
    if (!staff.permissionLevel) {
      return false;
    }

    const requiredPermissions = Array.isArray(required) ? required : [required];
    
    // Permission hierarchy: manager > supervisor > staff
    const permissionHierarchy: Record<StaffRole, number> = {
      'staff': 1,
      'supervisor': 2,
      'manager': 3,
    };

    const userLevel = permissionHierarchy[staff.permissionLevel];

    return requiredPermissions.some(perm => {
      const requiredLevel = permissionHierarchy[perm];
      return userLevel >= requiredLevel;
    });
  };

  const getPermissionLabel = (permission: StaffRole): string => {
    const labels: Record<StaffRole, string> = {
      'staff': 'Staff',
      'supervisor': 'Supervisor',
      'manager': 'Manager',
    };
    return labels[permission];
  };

  const getPermissionDescription = (permission: StaffRole): string => {
    const descriptions: Record<StaffRole, string> = {
      'staff': 'Can perform pre-opening, daily, monthly, and yearly checks',
      'supervisor': 'Can perform checks, log maintenance, and view regulatory events',
      'manager': 'Full access to checks, maintenance, documents, and risk assessments',
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
