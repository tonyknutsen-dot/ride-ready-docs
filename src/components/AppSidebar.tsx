import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  FolderOpen,
  Calendar as CalendarIcon,
  FileText,
  Settings,
  ShieldCheck,
  CheckSquare,
  Send,
  CreditCard,
  HelpCircle,
  LogOut,
  Shield,
  Lightbulb,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Users,
  Download,
  Bell,
  Wind,
  AlertOctagon,
  Gauge,
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
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useStaff } from '@/contexts/StaffContext';
import { useToast } from '@/hooks/use-toast';
import { ContactSupportDialog } from '@/components/ContactSupportDialog';
import { RequestFeatureDialog } from '@/components/RequestFeatureDialog';
import { OfflineSyncIndicator } from '@/components/OfflineSyncIndicator';
import { useActionNeededCount } from '@/hooks/useActionNeededCount';
import { useOverdueCompliance } from '@/hooks/useOverdueCompliance';
import appLogo from '@/assets/app-logo.jpg';

type FeatureKey = 'calendar' | 'documents' | 'checks' | 'maintenance' | 'risk_assessments' | 'send_documents';

interface NavItemDef {
  title: string;
  url: string;
  icon: any;
  feature?: FeatureKey;
  ownerOnly?: boolean;
  isNotification?: boolean;
}

const mainNavItems: NavItemDef[] = [
  { title: 'Dashboard', url: '/overview', icon: Home },
  { title: 'Equipment', url: '/rides', icon: FolderOpen },
  { title: 'Calendar', url: '/calendar', icon: CalendarIcon, feature: 'calendar' },
  { title: 'Documents', url: '/documents', icon: FileText, feature: 'documents' },
];

const toolsNavItems: NavItemDef[] = [
  { title: 'Checks', url: '/checks', icon: CheckSquare, feature: 'checks' },
  { title: 'Defect Register', url: '/defects', icon: AlertOctagon },
  { title: 'Maintenance', url: '/maintenance', icon: Wrench, feature: 'maintenance' },
  { title: 'Wind Log', url: '/wind-log', icon: Wind },
  { title: 'Pressure Readings', url: '/pressure-readings', icon: Gauge },
  { title: 'Risk Assessments', url: '/risk-assessments', icon: ShieldCheck, feature: 'risk_assessments' },
  { title: 'Send Documents', url: '/send-documents', icon: Send, feature: 'send_documents' },
];

const accountNavItems: NavItemDef[] = [
  { title: 'Notifications', url: '/notifications', icon: Bell, ownerOnly: true, isNotification: true },
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
    canAccessCalendar,
    canAccessChecks,
    canAccessMaintenance,
    canAccessDocuments,
    canAccessRiskAssessments,
    canAccessSendDocuments,
    canAccessSettings,
    canManageStaff,
  } = useStaff();
  const { toast } = useToast();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const unreadCount = useActionNeededCount();
  const overdueCount = useOverdueCompliance();

  const hasFeatureAccess = (feature?: FeatureKey) => {
    if (!feature) return true;
    if (isOwner && !isStaff) return true;
    const featureMap: Record<FeatureKey, boolean> = {
      calendar: canAccessCalendar,
      documents: canAccessDocuments,
      checks: canAccessChecks,
      maintenance: canAccessMaintenance,
      risk_assessments: canAccessRiskAssessments,
      send_documents: canAccessSendDocuments,
    };
    return featureMap[feature] ?? false;
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error && !error.message?.includes('session')) {
      toast({ title: 'Error signing out', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Signed out successfully' });
      window.location.href = '/';
    }
  };

  const isActive = (path: string) => {
    if (path === '/rides') return location.pathname === '/rides' || location.pathname.startsWith('/rides/');
    return location.pathname === path;
  };

  const filterNavItems = (items: NavItemDef[]) =>
    items.filter(item => {
      if (item.ownerOnly && isStaff) return false;
      if (item.url === '/settings' && !canAccessSettings) return false;
      if (item.feature && !hasFeatureAccess(item.feature)) return false;
      return true;
    });

  const filteredMainNav = filterNavItems(mainNavItems);
  const filteredToolsNav = filterNavItems(toolsNavItems);
  const filteredAccountNav = filterNavItems(accountNavItems);

  // Primary nav item — full size for Main/Tools
  const NavItem = ({ item, secondary = false }: { item: NavItemDef; secondary?: boolean }) => {
    const active = isActive(item.url);
    const Icon = item.icon;
    const showNotificationBadge = item.isNotification && unreadCount > 0;
    const showOverdueBadge = item.url === '/overview' && overdueCount > 0;
    const badgeCount = showNotificationBadge ? unreadCount : showOverdueBadge ? overdueCount : 0;
    const showBadge = showNotificationBadge || showOverdueBadge;

    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={active}>
          <Link
            to={item.url}
            className={`flex items-center gap-3 px-3 rounded-lg transition-all ${
              secondary ? 'py-1.5 text-[13px]' : 'py-2 text-sm'
            } ${
              active
                ? 'bg-primary text-primary-foreground font-medium'
                : secondary
                  ? 'text-muted-foreground/70 hover:text-foreground hover:bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span className="relative flex-shrink-0">
              <Icon className={secondary ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
              {showBadge && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              )}
            </span>
            {!collapsed && <span className="flex-1">{item.title}</span>}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const SectionLabel = ({ children, secondary = false }: { children: React.ReactNode; secondary?: boolean }) =>
    !collapsed ? (
      <SidebarGroupLabel className={`uppercase tracking-[0.08em] font-medium px-3 mb-0.5 mt-0 ${
        secondary
          ? 'text-[8px] text-muted-foreground/30'
          : 'text-[9px] text-muted-foreground/40'
      }`}>
        {children}
      </SidebarGroupLabel>
    ) : null;

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="border-r border-border/40 bg-background hidden md:flex"
      >
        {/* Header */}
        <SidebarHeader className="px-4 py-3">
          <Link to="/overview" className="flex items-center gap-3 group">
            <img src={appLogo} alt="Ride Ready Docs" className="h-8 w-8 rounded-full" />
            {!collapsed && (
              <span className="font-bold text-lg group-hover:text-primary transition-colors">
                Ride Ready Docs
              </span>
            )}
          </Link>
        </SidebarHeader>

        {/* Single continuous scroll area */}
        <SidebarContent className="px-2 py-0.5 overflow-y-auto">
          {/* Main */}
          <SidebarGroup className="py-0">
            <SectionLabel>Main</SectionLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {filteredMainNav.map(item => (
                  <NavItem key={item.url} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Tools */}
          {filteredToolsNav.length > 0 && (
            <SidebarGroup className="py-0 mt-3">
              <SectionLabel>Tools</SectionLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {filteredToolsNav.map(item => (
                    <NavItem key={item.url} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Visual break — hierarchy shift to secondary nav */}
          {!collapsed && <div className="mx-3 my-3 border-t border-border/20" />}
          {collapsed && <div className="my-2" />}

          {/* Account — secondary treatment */}
          <SidebarGroup className="py-0">
            <SectionLabel secondary>Account</SectionLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {filteredAccountNav.map(item => (
                  <NavItem key={item.url} item={item} secondary />
                ))}
                {canManageStaff && (
                  <NavItem item={{ title: 'Staff', url: '/staff', icon: Users }} secondary />
                )}
                <NavItem item={{ title: 'Install App', url: '/install', icon: Download }} secondary />
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setFeatureDialogOpen(true)}
                    className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-all cursor-pointer"
                  >
                    <Lightbulb className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>Request Feature</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Admin — secondary treatment */}
          {isAdmin && (
            <SidebarGroup className="py-0 mt-1.5">
              <SectionLabel secondary>Admin</SectionLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname.startsWith('/admin')}>
                      <Link
                        to="/admin"
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all text-[13px] ${
                          location.pathname.startsWith('/admin')
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <Shield className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span>Admin Dashboard</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Footer utility block — inside scroll, docked feel */}
          <div className="mt-auto pt-3">
            <div className="mx-1 rounded-md bg-muted/20 px-1 py-1.5">
              <SidebarMenu className="gap-0">
                {/* Sync status */}
                <SidebarMenuItem>
                  <div className="px-1 py-0.5">
                    <OfflineSyncIndicator compact={collapsed} />
                  </div>
                </SidebarMenuItem>

                {/* Contact Support */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setContactDialogOpen(true)}
                    className="flex items-center gap-3 px-3 py-1 rounded-md text-xs text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-all cursor-pointer"
                  >
                    <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    {!collapsed && <span>Contact Support</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Sign Out */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-3 py-1 rounded-md text-xs text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
                    {!collapsed && <span>Sign Out</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Collapse */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={toggleSidebar}
                    className="flex items-center gap-3 px-3 py-1 rounded-md text-xs text-muted-foreground/35 hover:text-muted-foreground hover:bg-muted transition-all cursor-pointer"
                  >
                    {collapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                    ) : (
                      <>
                        <ChevronLeft className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Collapse</span>
                      </>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </div>
        </SidebarContent>
      </Sidebar>

      {/* Dialogs */}
      {featureDialogOpen && (
        <RequestFeatureDialog
          open={featureDialogOpen}
          onOpenChange={setFeatureDialogOpen}
          hideTrigger
        />
      )}
      {contactDialogOpen && (
        <ContactSupportDialog
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
        />
      )}
    </>
  );
}
