import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProfileComplete } from '@/hooks/useProfileComplete';
import { Skeleton } from '@/components/ui/skeleton';

interface ProfileGuardProps {
  children: ReactNode;
}

export function ProfileGuard({ children }: ProfileGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isProfileComplete, loading } = useProfileComplete();

  useEffect(() => {
    // Don't redirect if we're already on the setup page or auth pages
    if (loading || 
        location.pathname === '/auth' ||
        location.pathname === '/') {
      return;
    }

    // Staff members should never be on profile-setup - redirect them away
    if (location.pathname === '/profile-setup' && isProfileComplete) {
      navigate('/overview', { replace: true });
      return;
    }

    // Redirect to profile setup if profile is incomplete (only for non-staff)
    if (isProfileComplete === false) {
      navigate('/profile-setup', { replace: true });
    }
  }, [isProfileComplete, loading, navigate, location.pathname]);

  // Show loading state while checking profile
  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // If profile is incomplete and we're not on an exempt page, don't render children
  // (they'll be redirected in the effect above)
  if (isProfileComplete === false && 
      location.pathname !== '/profile-setup' && 
      location.pathname !== '/auth' &&
      location.pathname !== '/') {
    return null;
  }

  return <>{children}</>;
}
