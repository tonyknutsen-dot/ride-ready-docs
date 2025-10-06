import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Home, FolderOpen, Shield, User, LogOut, MoreHorizontal, CreditCard, HelpCircle, Settings, FileText, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isDocs } from '@/config/appFlavor';
import { QuickDocumentUpload } from '@/components/QuickDocumentUpload';
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

const AppHeader = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

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
                {isDocs ? 'Rides' : 'Equipment'}
              </Button>
            </Link>
            {isDocs && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Shield className="h-4 w-4" />
                Add Doc
              </Button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* More Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <MoreHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>More Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem asChild>
                <Link to="/" className="flex items-center cursor-pointer">
                  <Home className="h-4 w-4 mr-2" />
                  Homepage
                </Link>
              </DropdownMenuItem>
              
              {isDocs && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/global-documents" className="flex items-center cursor-pointer">
                      <FileText className="h-4 w-4 mr-2" />
                      Global Documents
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              
              <DropdownMenuSeparator />
              
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

          <Link to="/settings">
            <Button 
              variant={isActive('/settings') ? 'default' : 'ghost'} 
              size="sm" 
              className="gap-2 hidden sm:flex"
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

      {/* Quick Document Upload Dialog */}
      <QuickDocumentUpload 
        open={uploadDialogOpen} 
        onOpenChange={setUploadDialogOpen} 
      />
    </header>
  );
};

export default AppHeader;
