import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, FolderOpen, CheckSquare, MoreHorizontal, Bell,
  Calendar as CalendarIcon, CreditCard, HelpCircle, Settings, FileText, PlusCircle, ShieldCheck, LogOut, Send, Wrench, Shield, Lightbulb, Users, Download
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ContactSupportDialog } from "@/components/ContactSupportDialog";
import { QuickDocumentUpload } from "@/components/QuickDocumentUpload";
import { RequestFeatureDialog } from "@/components/RequestFeatureDialog";
import { OfflineSyncIndicator } from "@/components/OfflineSyncIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useStaff } from "@/contexts/StaffContext";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";

// Routes where the mobile nav should NOT appear (public pages - landing/marketing only)
const PUBLIC_ROUTES = ['/', '/auth', '/how-it-works', '/privacy', '/terms', '/security'];

export default function MobileBottomNav() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { 
    isStaff,
    canAccessCalendar,
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
  const [open, setOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const unreadCount = useUnreadNotifications();

  // Don't show on public pages or if not logged in
  if (!user || PUBLIC_ROUTES.includes(loc.pathname)) return null;

  const go = (path: string) => {
    nav(path);
    setOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: "Signed out successfully" });
    } catch (error) {
      toast({ title: "Error signing out", variant: "destructive" });
    }
  };

  const isActive = (paths: string[]) => 
    paths.some(p => loc.pathname === p || loc.pathname.startsWith(p + '/'));

  const NavButton = ({ 
    onClick, 
    active, 
    icon: Icon, 
    label,
    highlight = false
  }: { 
    onClick: () => void; 
    active: boolean; 
    icon: any; 
    label: string;
    highlight?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center min-h-[56px] min-w-[56px] rounded-xl text-[11px] font-medium transition-all active:scale-95 ${
        active 
          ? "text-primary bg-primary/10" 
          : highlight
          ? "text-success"
          : "text-muted-foreground hover:text-foreground"
      }`}
      aria-label={label}
    >
      <Icon className={`h-6 w-6 ${highlight && !active ? 'text-success' : ''}`} />
      <span className="mt-0.5">{label}</span>
    </button>
  );

  // Menu item component for the sheet
  const MenuItem = ({ 
    icon: Icon, 
    label, 
    onClick, 
    active = false,
    variant = "default" 
  }: { 
    icon: any; 
    label: string; 
    onClick: () => void; 
    active?: boolean;
    variant?: "default" | "primary" | "accent" | "success" | "info" | "destructive";
  }) => {
    const variantStyles = {
      default: "text-muted-foreground hover:text-foreground hover:bg-muted",
      primary: "text-primary hover:bg-primary/10",
      accent: "text-accent hover:bg-accent/10",
      success: "text-success hover:bg-success/10",
      info: "text-info hover:bg-info/10",
      destructive: "text-destructive hover:bg-destructive/10",
    };

    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
          active 
            ? "bg-primary text-primary-foreground" 
            : variantStyles[variant]
        }`}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 md:hidden safe-area-pb">
      <div className={`mx-auto max-w-screen-sm grid gap-1 px-2 py-1 ${canAccessChecks ? (canAccessCalendar ? 'grid-cols-5' : 'grid-cols-4') : (canAccessCalendar ? 'grid-cols-4' : 'grid-cols-3')}`}>
        {/* Overview */}
        <NavButton 
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            go("/overview");
          }}
          active={isActive(["/overview"])}
          icon={Home}
          label="Dashboard"
        />

        {/* Rides/Equipment */}
        <NavButton 
          onClick={() => go("/rides")}
          active={isActive(["/rides"])}
          icon={FolderOpen}
          label="Rides"
        />

        {/* CHECKS - Central prominent button (only if has permission) */}
        {canAccessChecks && (
          <NavButton 
            onClick={() => go("/checks")}
            active={isActive(["/checks"])}
            icon={CheckSquare}
            label="Checks"
            highlight={true}
          />
        )}

        {/* Calendar - only if has permission */}
        {canAccessCalendar && (
          <NavButton 
            onClick={() => go("/calendar")}
            active={isActive(["/calendar"])}
            icon={CalendarIcon}
            label="Calendar"
          />
        )}

        {/* More - Full menu sheet */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button 
              className="flex flex-col items-center justify-center min-h-[56px] min-w-[56px] rounded-xl text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all active:scale-95" 
              aria-label="More"
            >
              <MoreHorizontal className="h-6 w-6" />
              <span className="mt-0.5">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] rounded-t-3xl px-4 pb-8 border-t-2 border-primary/20 overflow-y-auto">
            <SheetHeader className="pb-4 sticky top-0 bg-background z-10">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-left text-lg">Menu</SheetTitle>
                <OfflineSyncIndicator />
              </div>
            </SheetHeader>

            <div className="space-y-4">
              {/* Quick Actions - filtered by permission */}
              <div className="grid grid-cols-3 gap-2">
                {canAccessDocuments && (
                  <button
                    className="flex flex-col items-center gap-2 p-3 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl text-sm font-medium hover:bg-primary/15 transition-all active:scale-95"
                    onClick={() => setUploadDialogOpen(true)}
                  >
                    <div className="p-2.5 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg">
                      <PlusCircle className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs">Upload</span>
                  </button>
                )}
                {canAccessSendDocuments && (
                  <button
                    className="flex flex-col items-center gap-2 p-3 bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 rounded-xl text-sm font-medium hover:bg-accent/15 transition-all active:scale-95"
                    onClick={() => go("/send-documents")}
                  >
                    <div className="p-2.5 bg-gradient-to-br from-accent/20 to-accent/10 rounded-lg">
                      <Send className="h-5 w-5 text-accent" />
                    </div>
                    <span className="text-xs">Send</span>
                  </button>
                )}
                {canAccessRiskAssessments && (
                  <button
                    className="flex flex-col items-center gap-2 p-3 bg-gradient-to-br from-success/5 to-success/10 border border-success/20 rounded-xl text-sm font-medium hover:bg-success/15 transition-all active:scale-95"
                    onClick={() => go("/risk-assessments")}
                  >
                    <div className="p-2.5 bg-gradient-to-br from-success/20 to-success/10 rounded-lg">
                      <ShieldCheck className="h-5 w-5 text-success" />
                    </div>
                    <span className="text-xs">Risk Assessment</span>
                  </button>
                )}
              </div>

              <Separator />

              {/* Account Section - filtered by permission */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground px-2 mb-2">Account</p>
                {!isStaff && (
                  <button
                    onClick={() => go("/notifications")}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
                      isActive(["/settings"])
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="relative flex-shrink-0">
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </span>
                    <span>Notifications</span>
                  </button>
                )}
                {canAccessBilling && (
                  <MenuItem 
                    icon={CreditCard} 
                    label="Plan & Billing" 
                    onClick={() => go("/billing")} 
                    active={isActive(["/billing"])}
                  />
                )}
                {canManageStaff && (
                  <MenuItem 
                    icon={Users} 
                    label="Staff Management" 
                    onClick={() => go("/staff")} 
                    active={isActive(["/staff"])}
                  />
                )}
                <MenuItem 
                  icon={HelpCircle} 
                  label="Help & Support" 
                  onClick={() => go("/help")} 
                  active={isActive(["/help"])}
                />
                <MenuItem 
                  icon={Download} 
                  label="Install App" 
                  onClick={() => go("/install")} 
                  active={isActive(["/install"])}
                  variant="info"
                />
                <MenuItem 
                  icon={Lightbulb} 
                  label="Request Feature" 
                  onClick={() => {
                    setOpen(false);
                    setFeatureDialogOpen(true);
                  }}
                />
              </div>

              {/* Admin Section */}
              {isAdmin && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground px-2 mb-2">Admin</p>
                    <MenuItem 
                      icon={Shield} 
                      label="Admin Dashboard" 
                      onClick={() => go("/admin")} 
                      active={isActive(["/admin"])}
                      variant="primary"
                    />
                  </div>
                </>
              )}

              <Separator />

              {/* Support & Sign Out */}
              <div className="space-y-2 pt-2">
                <ContactSupportDialog />
                <button
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-destructive/5 border border-destructive/30 text-destructive rounded-xl text-sm font-medium hover:bg-destructive/10 transition-all active:scale-[0.98]"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Quick Document Upload Dialog */}
      <QuickDocumentUpload 
        open={uploadDialogOpen} 
        onOpenChange={setUploadDialogOpen} 
      />

      {/* Request Feature Dialog */}
      <RequestFeatureDialog
        open={featureDialogOpen}
        onOpenChange={setFeatureDialogOpen}
        hideTrigger
      />
    </div>
  );
}