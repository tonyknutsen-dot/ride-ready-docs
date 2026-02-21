import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTester } from '@/contexts/TesterContext';
import appLogo from '@/assets/app-logo.jpg';
import { getOfflineIdentity } from '@/lib/offlineIdentity';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { isTester } = useTester();
  const location = useLocation();

  if (loading) {
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

  if (!user) {
    // If offline and we have a cached identity, don't redirect to auth
    if (!navigator.onLine) {
      const cached = getOfflineIdentity();
      if (cached) {
        // Let the app render – AuthContext will have set the user from cache
        return (
          <div className={isTester ? 'pt-8' : ''}>
            {children}
          </div>
        );
      }
    }
    // Redirect to auth page but save the attempted location
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return (
    <div className={isTester ? 'pt-8' : ''}>
      {children}
    </div>
  );
};

export default ProtectedRoute;