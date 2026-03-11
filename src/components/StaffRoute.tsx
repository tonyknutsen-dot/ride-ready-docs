import { Navigate } from 'react-router-dom';
import { useStaff } from '@/contexts/StaffContext';
import { Loader2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type StaffRole = Database['public']['Enums']['staff_role'];

interface StaffRouteProps {
  children: React.ReactNode;
  /** Required permission level(s). If not provided, only owners can access */
  requiredPermission?: StaffRole | StaffRole[];
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
    
    // Simple check — staff role matches any required permission
    const hasAccess = requiredPermissions.includes(permissionLevel);

    if (hasAccess) {
      return <>{children}</>;
    }
  }

  // Redirect to overview if no access
  return <Navigate to="/overview" replace />;
}
