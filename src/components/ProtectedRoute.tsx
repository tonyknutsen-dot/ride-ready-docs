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

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { isTester } = useTester();
  const location = useLocation();
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (loading || user || refreshAttempted || refreshing) return;

    let isMounted = true;

    const tryRefresh = async () => {
      setRefreshing(true);
      try {
        await supabase.auth.refreshSession();
      } finally {
        if (isMounted) {
          setRefreshing(false);
          setRefreshAttempted(true);
        }
      }
    };

    void tryRefresh();

    return () => {
      isMounted = false;
    };
  }, [loading, user, refreshAttempted, refreshing]);

  if (loading || refreshing || (!user && !refreshAttempted)) {
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

  // No user at all (no session) – redirect to auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return (
    <div className={isTester ? 'pt-8' : ''}>
      {children}
    </div>
  );
};

export default ProtectedRoute;
