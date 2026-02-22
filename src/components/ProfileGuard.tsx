import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProfileComplete } from '@/hooks/useProfileComplete';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { CloudOff } from 'lucide-react';

interface ProfileGuardProps {
  children: ReactNode;
}

export function ProfileGuard({ children }: ProfileGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isProfileComplete, loading } = useProfileComplete();
  const { isOfflineMode, cachedIdentity, user } = useAuth();

  useEffect(() => {
    if (loading ||
        location.pathname === '/auth' ||
        location.pathname === '/') {
      return;
    }

    // Never redirect to onboarding while in offline mode
    if (isOfflineMode || !navigator.onLine) {
      return;
    }

    // Staff members should never be on profile-setup - redirect them away
    if (location.pathname === '/profile-setup' && isProfileComplete) {
      navigate('/overview', { replace: true });
      return;
    }

    // Redirect to profile setup if profile is incomplete (only when online)
    if (isProfileComplete === false) {
      navigate('/profile-setup', { replace: true });
    }
  }, [isProfileComplete, loading, navigate, location.pathname, isOfflineMode]);

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

  // Offline with session but NO cached identity = first-time user
  if ((isOfflineMode || !navigator.onLine) && user && !cachedIdentity) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <CloudOff className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Internet required for first sign-in</h2>
          <p className="text-sm text-muted-foreground">
            Connect to the internet once to finish setting up your account. After that, you can use the app offline.
          </p>
        </div>
      </div>
    );
  }

  // If profile is incomplete and we're not on an exempt page, show loading
  // while the redirect effect above navigates to profile-setup
  if (isProfileComplete === false &&
      location.pathname !== '/profile-setup' &&
      location.pathname !== '/auth' &&
      location.pathname !== '/') {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
