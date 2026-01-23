import { Link, useLocation } from 'react-router-dom';
import { Shield, FileText, FolderOpen, Users, LogOut, Menu, MessageCircle, Mail, Activity, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface PendingCounts {
  rideRequests: number;
  documentRequests: number;
  supportMessages: number;
  bugReports: number;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const { signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCounts, setPendingCounts] = useState<PendingCounts>({
    rideRequests: 0,
    documentRequests: 0,
    supportMessages: 0,
    bugReports: 0,
  });

  useEffect(() => {
    const fetchPendingCounts = async () => {
      const [rideRes, docRes, supportRes, bugRes] = await Promise.all([
        supabase.from('ride_type_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('document_type_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('support_messages').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        (supabase as any).from('bug_reports').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress']),
      ]);

      setPendingCounts({
        rideRequests: rideRes.count || 0,
        documentRequests: docRes.count || 0,
        supportMessages: supportRes.count || 0,
        bugReports: bugRes.count || 0,
      });
    };

    fetchPendingCounts();
  }, [location.pathname]);

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: Shield, count: 0 },
    { name: 'Bug Reports', href: '/admin/bug-reports', icon: Bug, count: pendingCounts.bugReports },
    { name: 'Ride Type Requests', href: '/admin/ride-requests', icon: FolderOpen, count: pendingCounts.rideRequests },
    { name: 'Document Type Requests', href: '/admin/document-requests', icon: FileText, count: pendingCounts.documentRequests },
    { name: 'Support Messages', href: '/admin/support', icon: MessageCircle, count: pendingCounts.supportMessages },
    { name: 'User Management', href: '/admin/users', icon: Users, count: 0 },
    { name: 'Security', href: '/admin/security', icon: Activity, count: 0 },
    { name: 'Marketing', href: '/marketing', icon: Mail, count: 0 },
  ];

  const NavigationContent = () => (
    <nav className="p-4 space-y-1">
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <div className="flex items-center space-x-3">
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </div>
            {item.count > 0 && (
              <Badge 
                variant={isActive ? "secondary" : "destructive"} 
                className="ml-2 h-5 min-w-[20px] flex items-center justify-center text-xs"
              >
                {item.count}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      {/* Admin Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center space-x-2 md:space-x-3">
            {/* Mobile menu trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="py-4">
                  <div className="px-4 mb-4">
                    <div className="flex items-center space-x-3">
                      <Shield className="h-6 w-6 text-primary" />
                      <h2 className="text-lg font-semibold">Admin Panel</h2>
                    </div>
                  </div>
                  <NavigationContent />
                </div>
              </SheetContent>
            </Sheet>
            
            <Shield className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            <h1 className="text-lg md:text-xl font-semibold">Admin Panel</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Link to="/overview" className="hidden sm:block">
              <Button variant="outline" size="sm">Back to App</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut} className="hidden sm:flex">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="sm:hidden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 border-r bg-card min-h-[calc(100vh-73px)] sticky top-[73px]">
          <NavigationContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};