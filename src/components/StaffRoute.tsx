import { Navigate } from 'react-router-dom';
import { useStaff } from '@/contexts/StaffContext';
import { Loader2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type StaffPermission = Database['public']['Enums']['staff_permission'];

interface StaffRouteProps {
  children: React.ReactNode;
  /** Required permission level(s). If not provided, only owners can access */
  requiredPermission?: StaffPermission | StaffPermission[];
  /** If true, only owners can access this route */
  ownerOnly?: boolean;
}

export function StaffRoute({ children, requiredPermission, ownerOnly = false }: StaffRouteProps) {
  const { isStaff, isOwner, permissionLevel, loading } = useStaff();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Owner-only routes (billing, settings, staff management)
  if (ownerOnly) {
    if (isStaff) {
      return <Navigate to="/overview" replace />;
    }
    return <>{children}</>;
  }

  // If no permission required, allow all authenticated users
  if (!requiredPermission) {
    return <>{children}</>;
  }

  // Owners have access to everything
  if (isOwner && !isStaff) {
    return <>{children}</>;
  }

  // Check staff permission level
  if (isStaff && permissionLevel) {
    const requiredPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    
    const permissionHierarchy: Record<StaffPermission, number> = {
      'checks_only': 1,
      'checks_maintenance': 2,
      'full_access': 3,
    };

    const userLevel = permissionHierarchy[permissionLevel];
    const hasAccess = requiredPermissions.some(perm => {
      const requiredLevel = permissionHierarchy[perm];
      return userLevel >= requiredLevel;
    });

    if (hasAccess) {
      return <>{children}</>;
    }
  }

  // Redirect to overview if no access
  return <Navigate to="/overview" replace />;
}
