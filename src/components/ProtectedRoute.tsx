import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, FileText } from 'lucide-react';
import { useTester } from '@/contexts/TesterContext';

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
          <FileText className="mx-auto h-12 w-12 text-primary" />
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
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