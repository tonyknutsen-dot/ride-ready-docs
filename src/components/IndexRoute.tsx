import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Index from "@/pages/Index";

/**
 * Public landing page. Signed-in users are routed into the app; signed-out
 * users see the marketing/landing page with Sign In / Sign Up CTAs.
 */
const IndexRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/overview" replace />;
  return <Index />;
};

export default IndexRoute;
