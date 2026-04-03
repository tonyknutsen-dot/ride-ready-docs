import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  FolderOpen,
  CheckSquare,
  MoreHorizontal,
  Bell,
  Calendar as CalendarIcon,
  CreditCard,
  HelpCircle,
  Settings,
  FileText,
  LogOut,
  Shield,
  Users,
  Download,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { OfflineSyncIndicator } from "@/components/OfflineSyncIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useStaff } from "@/contexts/StaffContext";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useActionNeededCount } from "@/hooks/useActionNeededCount";
import { useOverdueCompliance } from "@/hooks/useOverdueCompliance";

const PUBLIC_ROUTES = ["/", "/auth", "/how-it-works", "/privacy", "/terms", "/security"];
const HIDDEN_ROUTE_PATTERNS = ["/execute"];

type DrawerItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  matchPaths?: string[];
  visible?: boolean;
  badgeCount?: number;
};

export default function MobileBottomNav() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const {
    isStaff,
    canAccessCalendar,
    canAccessChecks,
    canAccessDocuments,
    canAccessBilling,
    canAccessSettings,
    canManageStaff,
  } = useStaff();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const unreadCount = useActionNeededCount();
  const overdueCount = useOverdueCompliance();

  if (!user || PUBLIC_ROUTES.includes(loc.pathname) || HIDDEN_ROUTE_PATTERNS.some((p) => loc.pathname.includes(p))) {
    return null;
  }

  const go = (path: string) => {
    nav(path);
    setOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: "Signed out successfully" });
    } catch {
      toast({ title: "Error signing out", variant: "destructive" });
    }
  };

  const isActive = (paths: string[]) =>
    paths.some((p) => loc.pathname === p || loc.pathname.startsWith(`${p}/`));

  const primaryItems: DrawerItem[] = [
    { icon: Home, label: "Dashboard", path: "/overview", matchPaths: ["/overview"], badgeCount: overdueCount },
    { icon: FolderOpen, label: "Equipment", path: "/rides", matchPaths: ["/rides"] },
    { icon: CheckSquare, label: "Checks", path: "/checks", matchPaths: ["/checks"], visible: canAccessChecks },
    { icon: CalendarIcon, label: "Calendar", path: "/calendar", matchPaths: ["/calendar"], visible: canAccessCalendar },
    { icon: FileText, label: "Documents", path: "/documents", matchPaths: ["/documents"], visible: canAccessDocuments },
  ].filter((item) => item.visible !== false);

  const accountItems: DrawerItem[] = [
    { icon: Bell, label: "Notifications", path: "/notifications", matchPaths: ["/notifications"], badgeCount: unreadCount },
    { icon: CreditCard, label: "Plan & Billing", path: "/billing", matchPaths: ["/billing"], visible: canAccessBilling },
    { icon: Settings, label: "Settings", path: "/settings", matchPaths: ["/settings"], visible: canAccessSettings },
    { icon: Users, label: "Staff Management", path: "/staff", matchPaths: ["/staff"], visible: canManageStaff },
    { icon: HelpCircle, label: "Help & Support", path: "/help", matchPaths: ["/help"] },
    { icon: Download, label: "Install App", path: "/install", matchPaths: ["/install"] },
  ].filter((item) => item.visible !== false);

  const adminItems: DrawerItem[] = [
    { icon: Shield, label: "Admin Dashboard", path: "/admin", matchPaths: ["/admin"], visible: isAdmin },
  ].filter((item) => item.visible !== false);

  const NavButton = ({ onClick, active, icon: Icon, label }: { onClick: () => void; active: boolean; icon: LucideIcon; label: string }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center min-h-[56px] min-w-[56px] rounded-none text-[11px] font-medium transition-all active:scale-95 border-t-2 ${
        active
          ? "text-[#1E3A5F] border-t-[#1E3A5F]"
          : "text-[#64748B] border-t-transparent hover:text-foreground"
      }`}
      aria-label={label}
    >
      <Icon className={`h-6 w-6 ${active ? "text-[#1E3A5F]" : "text-[#64748B]"}`} strokeWidth={2} />
      <span className="mt-0.5">{label}</span>
    </button>
  );

  const MenuItem = ({ item }: { item: DrawerItem }) => {
    const Icon = item.icon;
    const active = isActive(item.matchPaths ?? [item.path]);

    return (
      <button
        onClick={() => go(item.path)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98] ${
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        <span className="relative flex-shrink-0">
          <Icon className="h-[18px] w-[18px]" />
          {!!item.badgeCount && item.badgeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
              {item.badgeCount > 9 ? "9+" : item.badgeCount}
            </span>
          )}
        </span>
        <span>{item.label}</span>
      </button>
    );
  };

  const MenuSection = ({ title, items }: { title: string; items: DrawerItem[] }) => {
    if (!items.length) return null;

    return (
      <div className="space-y-0.5">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60 px-3 mb-1">{title}</p>
        {items.map((item) => (
          <MenuItem key={item.label} item={item} />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E2E8F0] bg-white md:hidden safe-area-pb">
      <div
        className={`mx-auto max-w-screen-sm grid gap-1 px-2 py-1 ${
          canAccessChecks ? (canAccessCalendar ? "grid-cols-5" : "grid-cols-4") : canAccessCalendar ? "grid-cols-4" : "grid-cols-3"
        }`}
      >
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
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
            <Home className={`h-6 w-6 ${isActive(["/overview"]) ? "text-[#1E3A5F]" : "text-[#64748B]"}`} strokeWidth={2} />
            {overdueCount > 0 && (
              <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
                {overdueCount > 9 ? "9+" : overdueCount}
              </span>
            )}
          </span>
          <span className="mt-0.5">Dashboard</span>
        </button>

        <NavButton onClick={() => go("/rides")} active={isActive(["/rides"])} icon={FolderOpen} label="Equipment" />

        {canAccessChecks && (
          <NavButton onClick={() => go("/checks")} active={isActive(["/checks"])} icon={CheckSquare} label="Checks" />
        )}

        {canAccessCalendar && (
          <NavButton onClick={() => go("/calendar")} active={isActive(["/calendar"])} icon={CalendarIcon} label="Calendar" />
        )}

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
              <MenuSection title="Main" items={primaryItems} />
              <MenuSection title="Account" items={accountItems} />
              <MenuSection title="Admin" items={adminItems} />

              <div className="space-y-0.5 mt-3 pt-3 border-t border-border/30">
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
    </div>
  );
}
