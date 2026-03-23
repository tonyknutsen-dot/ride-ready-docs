import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, FolderOpen, CheckSquare, MoreHorizontal, Bell,
  Calendar as CalendarIcon, CreditCard, HelpCircle, Settings, FileText, PlusCircle, ShieldCheck, LogOut, Send, Wrench, Shield, Lightbulb, Users, Download, MessageCircle, Wind, AlertOctagon, Gauge
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import { useOverdueCompliance } from "@/hooks/useOverdueCompliance";

// Routes where the mobile nav should NOT appear (public pages + full-screen workflows)
const PUBLIC_ROUTES = ['/', '/auth', '/how-it-works', '/privacy', '/terms', '/security'];
const HIDDEN_ROUTE_PATTERNS = ['/execute'];

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
  const overdueCount = useOverdueCompliance();

  // Don't show on public pages or if not logged in
  if (!user || PUBLIC_ROUTES.includes(loc.pathname) || HIDDEN_ROUTE_PATTERNS.some(p => loc.pathname.includes(p))) return null;

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
      className={`flex flex-col items-center justify-center min-h-[56px] min-w-[56px] rounded-none text-[11px] font-medium transition-all active:scale-95 border-t-2 ${
        active 
          ? "text-[#1E3A5F] border-t-[#1E3A5F]" 
          : "text-[#64748B] border-t-transparent hover:text-foreground"
      }`}
      aria-label={label}
    >
      <Icon className={`h-6 w-6 ${active ? 'text-[#1E3A5F]' : 'text-[#64748B]'}`} strokeWidth={2} />
      <span className="mt-0.5">{label}</span>
    </button>
  );

  // Menu item component for the sheet
  const MenuItem = ({ 
    icon: Icon, 
    label, 
    onClick, 
    active = false,
  }: { 
    icon: any; 
    label: string; 
    onClick: () => void; 
    active?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98] ${
        active 
          ? "bg-primary text-primary-foreground" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E2E8F0] bg-white md:hidden safe-area-pb">
      <div className={`mx-auto max-w-screen-sm grid gap-1 px-2 py-1 ${canAccessChecks ? (canAccessCalendar ? 'grid-cols-5' : 'grid-cols-4') : (canAccessCalendar ? 'grid-cols-4' : 'grid-cols-3')}`}>
        {/* Overview */}
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            go("/overview");
          }}
          className={`flex flex-col items-center justify-center min-h-[56px] min-w-[56px] rounded-none text-[11px] font-medium transition-all active:scale-95 border-t-2 ${
            isActive(["/overview"])
              ? "text-[#1E3A5F] border-t-[#1E3A5F]"
              : "text-[#64748B] border-t-transparent hover:text-foreground"
          }`}
          aria-label="Dashboard"
        >
          <span className="relative">
            <Home className={`h-6 w-6 ${isActive(["/overview"]) ? 'text-[#1E3A5F]' : 'text-[#64748B]'}`} strokeWidth={2} />
            {overdueCount > 0 && (
              <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
                {overdueCount > 9 ? '9+' : overdueCount}
              </span>
            )}
          </span>
          <span className="mt-0.5">Dashboard</span>
        </button>

        {/* Equipment */}
        <NavButton 
          onClick={() => go("/rides")}
          active={isActive(["/rides"])}
          icon={FolderOpen}
          label="Equipment"
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
              className="flex flex-col items-center justify-center min-h-[56px] min-w-[56px] rounded-none text-[11px] font-medium text-[#64748B] hover:text-foreground border-t-2 border-t-transparent transition-all active:scale-95" 
              aria-label="More"
            >
              <MoreHorizontal className="h-6 w-6 text-[#64748B]" strokeWidth={2} />
              <span className="mt-0.5">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] rounded-t-3xl px-4 pb-8 overflow-y-auto">
            <SheetHeader className="pb-2 sticky top-0 bg-background z-10">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-left text-base font-semibold">Menu</SheetTitle>
                <OfflineSyncIndicator compact />
              </div>
            </SheetHeader>

            <div className="space-y-3">
              {/* Tools */}
              {(canAccessDocuments || canAccessSendDocuments || canAccessRiskAssessments || canAccessMaintenance) && (
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60 px-3 mb-1">Tools</p>
                  {canAccessDocuments && (
                    <MenuItem icon={PlusCircle} label="Upload Document" onClick={() => setUploadDialogOpen(true)} />
                  )}
                  {canAccessSendDocuments && (
                    <MenuItem icon={Send} label="Send Documents" onClick={() => go("/send-documents")} active={isActive(["/send-documents"])} />
                  )}
                  {canAccessRiskAssessments && (
                    <MenuItem icon={ShieldCheck} label="Risk Assessments" onClick={() => go("/risk-assessments")} active={isActive(["/risk-assessments"])} />
                  )}
                  {canAccessMaintenance && (
                    <MenuItem icon={Wrench} label="Maintenance" onClick={() => go("/maintenance")} active={isActive(["/maintenance"])} />
                  )}
                  <MenuItem icon={AlertOctagon} label="Defect Register" onClick={() => go("/defects")} active={isActive(["/defects"])} />
                  <MenuItem icon={Wind} label="Wind Log" onClick={() => go("/wind-log")} active={isActive(["/wind-log"])} />
                  <MenuItem icon={Gauge} label="Pressure Readings" onClick={() => go("/pressure-readings")} active={isActive(["/pressure-readings"])} />
                </div>
              )}

              {/* Account */}
              <div className="space-y-0.5 pt-1">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60 px-3 mb-1">Account</p>
                {!isStaff && (
                  <button
                    onClick={() => go("/notifications")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98] ${
                      isActive(["/notifications"])
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="relative flex-shrink-0">
                      <Bell className="h-[18px] w-[18px]" />
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
                  <MenuItem icon={CreditCard} label="Plan & Billing" onClick={() => go("/billing")} active={isActive(["/billing"])} />
                )}
                {canAccessSettings && (
                  <MenuItem icon={Settings} label="Settings" onClick={() => go("/settings")} active={isActive(["/settings"])} />
                )}
                {canManageStaff && (
                  <MenuItem icon={Users} label="Staff Management" onClick={() => go("/staff")} active={isActive(["/staff"])} />
                )}
                <MenuItem icon={HelpCircle} label="Help & Support" onClick={() => go("/help")} active={isActive(["/help"])} />
                <MenuItem icon={Download} label="Install App" onClick={() => go("/install")} active={isActive(["/install"])} />
                <MenuItem icon={Lightbulb} label="Request Feature" onClick={() => { setOpen(false); setFeatureDialogOpen(true); }} />
              </div>

              {/* Admin */}
              {isAdmin && (
                <div className="space-y-0.5 pt-1">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60 px-3 mb-1">Admin</p>
                  <MenuItem icon={Shield} label="Admin Dashboard" onClick={() => go("/admin")} active={isActive(["/admin"])} />
                </div>
              )}

              {/* Footer */}
              <div className="space-y-0.5 mt-3 pt-3 border-t border-border/30">
                <ContactSupportDialog trigger={
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-[0.98]">
                    <MessageCircle className="h-[18px] w-[18px] flex-shrink-0" />
                    <span>Contact Support</span>
                  </button>
                } />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-[0.98]"
                >
                  <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
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