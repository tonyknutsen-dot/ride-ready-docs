import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  FolderOpen,
  Calendar as CalendarIcon,
  FileText,
  ShieldCheck,
  CheckSquare,
  Send,
  CreditCard,
  Settings,
  HelpCircle,
  LogOut,
  Shield,
  Lightbulb,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Users,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useStaff } from '@/contexts/StaffContext';
import { useToast } from '@/hooks/use-toast';
import { ContactSupportDialog } from '@/components/ContactSupportDialog';
import { RequestFeatureDialog } from '@/components/RequestFeatureDialog';
import logoIcon from '@/assets/logo-icon.png';

const mainNavItems = [
  { title: 'Overview', url: '/overview', icon: Home },
  { title: 'Rides', url: '/rides', icon: FolderOpen },
  { title: 'Calendar', url: '/calendar', icon: CalendarIcon },
  { title: 'Documents', url: '/documents', icon: FileText, requiresPermission: 'full_access' as const },
];

const featureNavItems = [
  { title: 'Checks', url: '/checks', icon: CheckSquare, requiresPermission: 'checks_only' as const },
  { title: 'Maintenance', url: '/maintenance', icon: Wrench, requiresPermission: 'checks_maintenance' as const },
  { title: 'Risk Assessments', url: '/risk-assessments', icon: ShieldCheck, requiresPermission: 'full_access' as const },
  { title: 'Send Documents', url: '/send-documents', icon: Send, requiresPermission: 'full_access' as const },
];

const accountNavItems = [
  { title: 'Plan & Billing', url: '/billing', icon: CreditCard, ownerOnly: true },
  { title: 'Settings', url: '/settings', icon: Settings, ownerOnly: true },
  { title: 'Help & Support', url: '/help', icon: HelpCircle },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { 
    isStaff, 
    isOwner, 
    permissionLevel,
    canAccessChecks,
    canAccessMaintenance,
    canAccessDocuments,
    canAccessRiskAssessments,
    canAccessSendDocuments,
    canAccessBilling,
    canAccessSettings,
    canManageStaff,
  } = useStaff();
  const { toast } = useToast();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';

  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  // Permission check helper
  const hasPermission = (requiredPermission?: 'checks_only' | 'checks_maintenance' | 'full_access') => {
    if (!requiredPermission) return true;
    if (isOwner && !isStaff) return true;
    if (!permissionLevel) return false;
    
    const hierarchy = { 'checks_only': 1, 'checks_maintenance': 2, 'full_access': 3 };
    return hierarchy[permissionLevel] >= hierarchy[requiredPermission];
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error && !error.message?.includes('session')) {
      toast({
        title: 'Error signing out',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Signed out successfully' });
      window.location.href = '/';
    }
  };

  const isActive = (path: string) => {
    if (path === '/rides') {
      return location.pathname === '/rides' || location.pathname.startsWith('/rides/');
    }
    return location.pathname === path;
  };

  // Filter nav items based on permissions
  type NavItem = { title: string; url: string; icon: any; requiresPermission?: 'checks_only' | 'checks_maintenance' | 'full_access'; ownerOnly?: boolean };
  
  const filterNavItems = (items: NavItem[]) => {
    return items.filter(item => {
      if (item.ownerOnly && isStaff) return false;
      if (item.requiresPermission && !hasPermission(item.requiresPermission)) return false;
      return true;
    });
  };

  const filteredMainNav = filterNavItems(mainNavItems as NavItem[]);
  const filteredFeatureNav = filterNavItems(featureNavItems as NavItem[]);
  const filteredAccountNav = filterNavItems(accountNavItems as NavItem[]);

  const NavItem = ({ item }: { item: NavItem }) => {
    const active = isActive(item.url);
    const Icon = item.icon;

    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={active}>
          <Link
            to={item.url}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
              active
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="border-r border-border/40 bg-background hidden md:flex"
      >
        <SidebarHeader className="p-4">
          <Link to="/overview" className="flex items-center gap-3 group">
            <img src={logoIcon} alt="Ride Ready Docs" className="h-8 w-8" />
            {!collapsed && (
              <span className="font-bold text-lg group-hover:text-primary transition-colors">
                Ride Ready Docs
              </span>
            )}
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-3">
          {/* Main Navigation */}
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground mb-2">
                Navigation
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredMainNav.map((item) => (
                  <NavItem key={item.url} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator className="my-3" />

          {/* Features */}
          {filteredFeatureNav.length > 0 && (
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-xs font-medium text-muted-foreground mb-2">
                  Features
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredFeatureNav.map((item) => (
                    <NavItem key={item.url} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          <Separator className="my-3" />

          {/* Account */}
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground mb-2">
                Account
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAccountNav.map((item) => (
                  <NavItem key={item.url} item={item} />
                ))}
                {/* Staff Management - owners only */}
                {canManageStaff && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname === '/settings' && location.hash === '#staff'}>
                      <Link
                        to="/settings#staff"
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-muted`}
                      >
                        <Users className="h-5 w-5 flex-shrink-0" />
                        {!collapsed && <span>Staff</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setFeatureDialogOpen(true)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
                  >
                    <Lightbulb className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>Request Feature</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Admin Section */}
          {isAdmin && (
            <>
              <Separator className="my-3" />
              <SidebarGroup>
                {!collapsed && (
                  <SidebarGroupLabel className="text-xs font-medium text-muted-foreground mb-2">
                    Admin
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.pathname.startsWith('/admin')}>
                        <Link
                          to="/admin"
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                            location.pathname.startsWith('/admin')
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'text-primary hover:bg-primary/10'
                          }`}
                        >
                          <Shield className="h-5 w-5 flex-shrink-0" />
                          {!collapsed && <span>Admin Dashboard</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </SidebarContent>

        <SidebarFooter className="p-3 space-y-2">
          {/* Contact Support */}
          <Button
            variant="outline"
            size="sm"
            className={`w-full ${collapsed ? 'px-2' : 'justify-start gap-2'}`}
            onClick={() => setContactDialogOpen(true)}
          >
            <MessageCircle className="h-4 w-4" />
            {!collapsed && <span>Contact Support</span>}
          </Button>

          {/* Sign Out */}
          <Button
            variant="ghost"
            size="sm"
            className={`w-full text-destructive hover:text-destructive hover:bg-destructive/10 ${collapsed ? 'px-2' : 'justify-start gap-2'}`}
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign Out</span>}
          </Button>

          {/* Collapse Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={`w-full text-muted-foreground ${collapsed ? 'px-2' : 'justify-start gap-2'}`}
            onClick={toggleSidebar}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </SidebarFooter>
      </Sidebar>

      {/* Dialogs - mounted outside sidebar */}
      <RequestFeatureDialog
        open={featureDialogOpen}
        onOpenChange={setFeatureDialogOpen}
        hideTrigger
      />
      <ContactSupportDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
      />
    </>
  );
}
