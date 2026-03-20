import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTester } from '@/contexts/TesterContext';
import { supabase } from '@/integrations/supabase/client';
import appLogo from '@/assets/app-logo.jpg';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const REFRESH_SESSION_TIMEOUT_MS = 10000;
const REDIRECT_GRACE_MS = 1500;
const LOADER_FAILSAFE_MS = 15000;

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { isTester } = useTester();
  const location = useLocation();
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [canRedirectToAuth, setCanRedirectToAuth] = useState(false);
  const [loaderTimedOut, setLoaderTimedOut] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (loading || user || refreshAttempted || refreshing) return;

    let isMounted = true;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error('refresh_session_timeout')), timeoutMs);
        }),
      ]);
    };

    const tryRefresh = async () => {
      setRefreshing(true);
      setCanRedirectToAuth(false);

      try {
        await withTimeout(supabase.auth.refreshSession(), REFRESH_SESSION_TIMEOUT_MS);
      } catch (error) {
        console.warn('[ProtectedRoute] refreshSession failed or timed out:', error);
      } finally {
        if (!isMounted) return;

        setRefreshing(false);
        setRefreshAttempted(true);
        redirectTimer = setTimeout(() => {
          if (isMounted) {
            setCanRedirectToAuth(true);
          }
        }, REDIRECT_GRACE_MS);
      }
    };

    void tryRefresh();

    return () => {
      isMounted = false;
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, [loading, user, refreshAttempted, refreshing, retryNonce]);

  const isWaitingForAuth =
    loading ||
    refreshing ||
    (!user && !refreshAttempted) ||
    (!user && refreshAttempted && !canRedirectToAuth);

  useEffect(() => {
    if (!isWaitingForAuth) {
      setLoaderTimedOut(false);
      return;
    }

    setLoaderTimedOut(false);
    const timer = setTimeout(() => {
      setLoaderTimedOut(true);
      console.warn('[ProtectedRoute] Auth loading timed out on route:', location.pathname);
    }, LOADER_FAILSAFE_MS);

    return () => clearTimeout(timer);
  }, [isWaitingForAuth, location.pathname]);

  const handleRetry = () => {
    setLoaderTimedOut(false);
    setCanRedirectToAuth(false);
    setRefreshAttempted(false);
    setRefreshing(false);
    setRetryNonce((value) => value + 1);
  };

  const handleGoToSignIn = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('[ProtectedRoute] signOut during recovery failed:', error);
    } finally {
      window.location.assign('/auth');
    }
  };

  if (isWaitingForAuth && !loaderTimedOut) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <img src={appLogo} alt="Ride Ready Docs" className="mx-auto h-20 w-20 rounded-full shadow-lg" />
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isWaitingForAuth && loaderTimedOut) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <img src={appLogo} alt="Ride Ready Docs" className="mx-auto h-20 w-20 rounded-full shadow-lg" />
          <p className="text-foreground font-medium">We couldn't restore your session automatically.</p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={handleGoToSignIn}
              className="px-3 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted"
            >
              Go to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <div className={isTester ? 'pt-8' : ''}>{children}</div>;
};

export default ProtectedRoute;
