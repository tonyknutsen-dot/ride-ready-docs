import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Home, FolderOpen, LogOut, MoreHorizontal, CreditCard, HelpCircle, Settings, FileText, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ContactSupportDialog } from '@/components/ContactSupportDialog';
import { RequestFeatureDialog } from '@/components/RequestFeatureDialog';
import logo from '@/assets/logo.png';

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

  const NavLink = ({ to, icon: Icon, children, active }: { to: string; icon: any; children: React.ReactNode; active: boolean }) => (
    <Link to={to}>
      <Button
        variant="ghost"
        size="sm"
        className={`gap-2 font-medium transition-all ${
          active 
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' 
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        <Icon className="h-4 w-4" />
        {children}
      </Button>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/overview" className="flex items-center gap-2 group">
            <img src={logo} alt="Ride Ready" className="h-8 w-auto" />
            <span className="font-bold text-lg hidden sm:inline group-hover:text-primary transition-colors">
              Ride Ready
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/overview" icon={Home} active={isActive('/overview')}>
              Overview
            </NavLink>
            <NavLink to="/rides" icon={FolderOpen} active={isActive('/rides')}>
              Rides
            </NavLink>
            <NavLink to="/global-documents" icon={FileText} active={isActive('/global-documents')}>
              Documents
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* More Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">More</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 z-[100] bg-popover shadow-elegant border-border/50">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                Navigation
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem asChild>
                <Link to="/" className="flex items-center cursor-pointer">
                  <Home className="h-4 w-4 mr-2" />
                  Homepage
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                Account
              </DropdownMenuLabel>
              
              <DropdownMenuItem asChild>
                <Link to="/billing" className="flex items-center cursor-pointer">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Plan & Billing
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuItem asChild>
                <Link to="/help" className="flex items-center cursor-pointer">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Help & Support
                </Link>
              </DropdownMenuItem>
              
              <RequestFeatureDialog />

              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <ContactSupportDialog />
            </DropdownMenuContent>
          </DropdownMenu>

          <Link to="/settings" className="hidden sm:block">
            <Button 
              variant={isActive('/settings') ? 'default' : 'ghost'} 
              size="sm" 
              className={`gap-2 ${isActive('/settings') ? '' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Settings className="h-4 w-4" />
              <span className="hidden md:inline">Settings</span>
            </Button>
          </Link>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut} 
            className="gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;