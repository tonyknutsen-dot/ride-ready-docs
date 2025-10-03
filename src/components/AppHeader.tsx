import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Home, FolderOpen, Shield, User, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isDocs } from '@/config/appFlavor';

const AppHeader = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
      });
    } catch (error) {
      toast({
        title: "Error signing out",
        variant: "destructive",
      });
    }
  };

  const isActive = (path: string) => {
    if (path === '/rides') {
      return location.pathname === '/rides' || location.pathname.startsWith('/rides/');
    }
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/overview" className="flex items-center space-x-2">
            <span className="font-bold text-lg">Ride Ready</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            <Link to="/overview">
              <Button
                variant={isActive('/overview') ? 'default' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Overview
              </Button>
            </Link>
            <Link to="/rides">
              <Button
                variant={isActive('/rides') ? 'default' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                Equipment
              </Button>
            </Link>
            {isDocs && (
              <Link to="/global-documents">
                <Button
                  variant={isActive('/global-documents') ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Global Docs
                </Button>
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button 
              variant={isActive('/settings') ? 'default' : 'ghost'} 
              size="sm" 
              className="gap-2"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
