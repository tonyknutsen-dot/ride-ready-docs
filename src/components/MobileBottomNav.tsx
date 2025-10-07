import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, FolderOpen, BadgeCheck, PlusCircle, MoreHorizontal,
  Calendar as CalendarIcon, CreditCard, HelpCircle, Settings, Mail, FileText,
  ClipboardList, Wrench, Shield, AlertTriangle
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ContactSupportDialog } from "@/components/ContactSupportDialog";
import { QuickDocumentUpload } from "@/components/QuickDocumentUpload";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useState } from "react";
import { useAppMode } from "@/hooks/useAppMode";
import { AppModeToggle } from "@/components/AppModeToggle";

/**
 * Mobile bottom bar:
 * - Uses real routes you have (/dashboard, /checks, /billing, /help)
 * - Calendar/Settings/Docs route to Dashboard tabs via ?tab=...
 * - After navigate, fires events so pages perform the intended action
 */

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
    // Give Router a tick to mount the destination, then fire any event
    setTimeout(() => { after?.(); }, 60);
    setOpen(false);
  };

  const isActive = (match: (loc: ReturnType<typeof useLocation>) => boolean) => match(loc);

  const primaryAction = () => {
    if (isOperationsMode) {
      // Operations mode: navigate to checks
      if (loc.pathname === "/checks") {
        window.dispatchEvent(new CustomEvent("rrd:start-check"));
        return;
      }
      go("/checks", () => window.dispatchEvent(new CustomEvent("rrd:start-check")));
      return;
    }

    // Documents mode: open quick document upload
    setUploadDialogOpen(true);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden pointer-events-auto">
      <div className="mx-auto max-w-screen-sm grid grid-cols-5 gap-1 p-2">
        {/* Overview */}
        <button
          onClick={() => {
            // Always scroll to top for feedback
            window.scrollTo({ top: 0, behavior: 'smooth' });
            // Navigate to overview page
            go("/overview");
          }}
          className={`flex flex-col items-center justify-center py-1 rounded-md text-xs ${
            isActive(l => l.pathname === "/overview") ? "text-primary" : "text-muted-foreground"
          }`}
          aria-label="Overview"
        >
          <Home className="h-5 w-5" />
          <span className="mt-0.5">Overview</span>
        </button>

        {/* Second button: Rides/Equipment or Checks */}
        {isDocumentsMode ? (
          <button
            onClick={() => {
              setOpen(false);
              nav("/rides");
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-md text-xs ${
              isActive(l => l.pathname === "/rides" || l.pathname.startsWith("/rides/")) ? "text-primary" : "text-muted-foreground"
            }`}
            aria-label="Rides"
          >
            <FolderOpen className="h-5 w-5" />
            <span className="mt-0.5">Rides</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setOpen(false);
              nav("/checks");
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-md text-xs ${
              isActive(l => l.pathname === "/checks") ? "text-primary" : "text-muted-foreground"
            }`}
            aria-label="Checks"
          >
            <BadgeCheck className="h-5 w-5" />
            <span className="mt-0.5">Checks</span>
          </button>
        )}

        {/* Third button: Calendar or Rides/Equipment */}
        {isDocumentsMode ? (
          <button
            onClick={() => {
              setOpen(false);
              nav("/calendar");
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-md text-xs ${
              isActive(l => l.pathname === "/calendar") ? "text-primary" : "text-muted-foreground"
            }`}
            aria-label="Calendar"
          >
            <CalendarIcon className="h-5 w-5" />
            <span className="mt-0.5">Calendar</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setOpen(false);
              nav("/rides");
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-md text-xs ${
              isActive(l => l.pathname === "/rides" || l.pathname.startsWith("/rides/")) ? "text-primary" : "text-muted-foreground"
            }`}
            aria-label="Rides"
          >
            <FolderOpen className="h-5 w-5" />
            <span className="mt-0.5">Rides</span>
          </button>
        )}

        {/* Primary Add */}
          <button
            onClick={primaryAction}
            className="flex flex-col items-center justify-center py-1 rounded-md text-xs text-primary"
            aria-label={isDocumentsMode ? "Add Document" : "Start Check"}
          >
            <PlusCircle className="h-6 w-6" />
            <span className="mt-0.5">{isDocumentsMode ? 'Add Doc' : 'Add'}</span>
          </button>

        {/* More */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center py-1 rounded-md text-xs text-muted-foreground" aria-label="More">
              <MoreHorizontal className="h-5 w-5" />
              <span className="mt-0.5">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
            <SheetHeader><SheetTitle>More</SheetTitle></SheetHeader>

            <div className="space-y-4 py-3">
              {/* App Mode Toggle */}
              <AppModeToggle />

              {/* Mode-specific features */}
              {isDocumentsMode && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Documents
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="btn-muted-tile"
                      onClick={() => go("/global-documents")}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Global Docs
                    </button>
                    <button
                      className="btn-muted-tile"
                      onClick={() => go("/calendar")}
                      disabled={subscription?.subscriptionStatus !== 'advanced'}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Calendar
                    </button>
                  </div>
                </div>
              )}

              {isOperationsMode && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Operations
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="btn-muted-tile"
                      onClick={() => go("/checks")}
                    >
                      <BadgeCheck className="h-4 w-4 mr-2" />
                      Checks
                    </button>
                    <button
                      className="btn-muted-tile"
                      onClick={() => go("/calendar")}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Calendar
                    </button>
                    <button
                      className="btn-muted-tile"
                      onClick={() => go("/risk-assessments")}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Risk
                    </button>
                  </div>
                </div>
              )}

              {/* General options */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  General
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="btn-muted-tile"
                    onClick={() => go("/billing")}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Billing
                  </button>

                  <button
                    className="btn-muted-tile"
                    onClick={() => go("/help")}
                  >
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Help
                  </button>

                  <button
                    className="btn-muted-tile"
                    onClick={() => go("/settings")}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </button>

                  <ContactSupportDialog />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2 border-t">
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
