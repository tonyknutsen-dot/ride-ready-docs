import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, FolderOpen, BadgeCheck, PlusCircle, MoreHorizontal,
  Calendar as CalendarIcon, CreditCard, HelpCircle, Settings, FileText, AlertTriangle
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ContactSupportDialog } from "@/components/ContactSupportDialog";
import { QuickDocumentUpload } from "@/components/QuickDocumentUpload";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useState } from "react";
import { useAppMode } from "@/contexts/AppModeContext";
import { AppModeToggle } from "@/components/AppModeToggle";

export default function MobileBottomNav() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const { isDocumentsMode, isOperationsMode } = useAppMode();
  const [open, setOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  if (!user) return null;

  const go = (path: string, after?: () => void) => {
    nav(path);
    setTimeout(() => { after?.(); }, 60);
    setOpen(false);
  };

  const isActive = (match: (loc: ReturnType<typeof useLocation>) => boolean) => match(loc);

  const primaryAction = () => {
    if (isOperationsMode) {
      if (loc.pathname === "/checks") {
        window.dispatchEvent(new CustomEvent("rrd:start-check"));
        return;
      }
      go("/checks", () => window.dispatchEvent(new CustomEvent("rrd:start-check")));
      return;
    }
    setUploadDialogOpen(true);
  };

  const NavButton = ({ 
    onClick, 
    active, 
    icon: Icon, 
    label,
    iconSize = "h-5 w-5"
  }: { 
    onClick: () => void; 
    active: boolean; 
    icon: any; 
    label: string;
    iconSize?: string;
  }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[11px] font-medium transition-colors ${
        active 
          ? "text-primary bg-primary/5" 
          : "text-muted-foreground hover:text-foreground"
      }`}
      aria-label={label}
    >
      <Icon className={iconSize} />
      <span className="mt-1">{label}</span>
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="mx-auto max-w-screen-sm grid grid-cols-5 gap-0.5 px-2 py-1.5 safe-area-pb">
        {/* Overview */}
        <NavButton 
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            go("/overview");
          }}
          active={isActive(l => l.pathname === "/overview")}
          icon={Home}
          label="Overview"
        />

        {/* Second button: Rides/Equipment or Checks */}
        {isDocumentsMode ? (
          <NavButton 
            onClick={() => {
              setOpen(false);
              nav("/rides");
            }}
            active={isActive(l => l.pathname === "/rides" || l.pathname.startsWith("/rides/"))}
            icon={FolderOpen}
            label="Rides"
          />
        ) : (
          <NavButton 
            onClick={() => {
              setOpen(false);
              nav("/checks");
            }}
            active={isActive(l => l.pathname === "/checks")}
            icon={BadgeCheck}
            label="Checks"
          />
        )}

        {/* Third button: Calendar or Rides/Equipment */}
        {isDocumentsMode ? (
          <NavButton 
            onClick={() => {
              setOpen(false);
              nav("/calendar");
            }}
            active={isActive(l => l.pathname === "/calendar")}
            icon={CalendarIcon}
            label="Calendar"
          />
        ) : (
          <NavButton 
            onClick={() => {
              setOpen(false);
              nav("/rides");
            }}
            active={isActive(l => l.pathname === "/rides" || l.pathname.startsWith("/rides/"))}
            icon={FolderOpen}
            label="Rides"
          />
        )}

        {/* Primary Add */}
        <button
          onClick={primaryAction}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[11px] font-medium text-accent hover:bg-accent/5 transition-colors"
          aria-label={isDocumentsMode ? "Add Document" : "Start Check"}
        >
          <div className="p-1.5 bg-accent rounded-full">
            <PlusCircle className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="mt-1">{isDocumentsMode ? 'Add' : 'Add'}</span>
        </button>

        {/* More */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button 
              className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors" 
              aria-label="More"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="mt-1">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader className="pb-4">
              <SheetTitle className="text-left">More Options</SheetTitle>
            </SheetHeader>

            <div className="space-y-6">
              {/* App Mode Toggle */}
              <AppModeToggle />

              {/* Mode-specific features */}
              {isDocumentsMode && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Documents
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="flex items-center gap-2.5 p-3 border border-border/50 rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors"
                      onClick={() => go("/global-documents")}
                    >
                      <FileText className="h-4 w-4 text-primary" />
                      Global Docs
                    </button>
                    <button
                      className="flex items-center gap-2.5 p-3 border border-border/50 rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
                      onClick={() => go("/calendar")}
                      disabled={subscription?.subscriptionStatus !== 'advanced'}
                    >
                      <CalendarIcon className="h-4 w-4 text-primary" />
                      Calendar
                    </button>
                  </div>
                </div>
              )}

              {isOperationsMode && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Operations
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="flex items-center gap-2.5 p-3 border border-border/50 rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors"
                      onClick={() => go("/checks")}
                    >
                      <BadgeCheck className="h-4 w-4 text-primary" />
                      Checks
                    </button>
                    <button
                      className="flex items-center gap-2.5 p-3 border border-border/50 rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors"
                      onClick={() => go("/calendar")}
                    >
                      <CalendarIcon className="h-4 w-4 text-primary" />
                      Calendar
                    </button>
                    <button
                      className="flex items-center gap-2.5 p-3 border border-border/50 rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors"
                      onClick={() => go("/risk-assessments")}
                    >
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      Risk
                    </button>
                  </div>
                </div>
              )}

              {/* General options */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Account
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="flex items-center gap-2.5 p-3 border border-border/50 rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors"
                    onClick={() => go("/billing")}
                  >
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    Billing
                  </button>

                  <button
                    className="flex items-center gap-2.5 p-3 border border-border/50 rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors"
                    onClick={() => go("/help")}
                  >
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    Help
                  </button>

                  <button
                    className="flex items-center gap-2.5 p-3 border border-border/50 rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors"
                    onClick={() => go("/settings")}
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Settings
                  </button>

                  <ContactSupportDialog />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center pt-6 mt-6 border-t border-border/50">
              Switch modes to access different features
            </p>
          </SheetContent>
        </Sheet>
      </div>

      {/* Quick Document Upload Dialog */}
      <QuickDocumentUpload 
        open={uploadDialogOpen} 
        onOpenChange={setUploadDialogOpen} 
      />
    </div>
  );
}