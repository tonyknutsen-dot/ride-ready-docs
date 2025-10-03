import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, FolderOpen, BadgeCheck, PlusCircle, MoreHorizontal,
  Calendar as CalendarIcon, CreditCard, HelpCircle, Settings, Mail, FileText
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ContactSupportDialog } from "@/components/ContactSupportDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useState } from "react";
import { isDocs, isChecks } from "@/config/appFlavor";

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
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const go = (path: string, after?: () => void) => {
    nav(path);
    // Give Router a tick to mount the destination, then fire any event
    setTimeout(() => { after?.(); }, 60);
    setOpen(false);
  };

  const isActive = (match: (loc: ReturnType<typeof useLocation>) => boolean) => match(loc);

  const primaryAction = () => {
    if (isChecks) {
      // Checks flavor: always start a check
      if (loc.pathname === "/checks") {
        window.dispatchEvent(new CustomEvent("rrd:start-check"));
        return;
      }
      go("/checks", () => window.dispatchEvent(new CustomEvent("rrd:start-check")));
      return;
    }

    // Docs flavor: add ride or upload doc
    const search = new URLSearchParams(loc.search);
    const tab = search.get("tab");

    if (loc.pathname === "/dashboard" && tab === "workspace") {
      window.dispatchEvent(new CustomEvent("rrd:add-ride"));
      return;
    }

    // Default: go to workspace and add ride
    go("/dashboard?tab=workspace", () => {
      window.dispatchEvent(new CustomEvent("rrd:add-ride"));
    });
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

        {/* Second button: Rides (Docs) or Checks (Checks flavor) */}
        {isDocs ? (
          <button
            onClick={() => go("/dashboard?tab=workspace")}
            className={`flex flex-col items-center justify-center py-1 rounded-md text-xs ${
              isActive(l => l.pathname === "/dashboard" && new URLSearchParams(l.search).get("tab") === "workspace") ? "text-primary" : "text-muted-foreground"
            }`}
            aria-label="Rides"
          >
            <FolderOpen className="h-5 w-5" />
            <span className="mt-0.5">Rides</span>
          </button>
        ) : (
          <button
            onClick={() => go("/checks")}
            className={`flex flex-col items-center justify-center py-1 rounded-md text-xs ${
              isActive(l => l.pathname === "/checks") ? "text-primary" : "text-muted-foreground"
            }`}
            aria-label="Checks"
          >
            <BadgeCheck className="h-5 w-5" />
            <span className="mt-0.5">Checks</span>
          </button>
        )}

        {/* Third button: Calendar (Docs flavor) or empty spacer (Checks flavor) */}
        {isDocs ? (
          <button
            onClick={() => {
              setOpen(false);
              nav("/dashboard?tab=calendar");
              // Scroll after navigation has completed
              setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }, 100);
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-md text-xs ${
              isActive(l => l.pathname === "/dashboard" && new URLSearchParams(l.search).get("tab") === "calendar") ? "text-primary" : "text-muted-foreground"
            }`}
            aria-label="Calendar"
          >
            <CalendarIcon className="h-5 w-5" />
            <span className="mt-0.5">Calendar</span>
          </button>
        ) : (
          <div className="flex flex-col items-center justify-center py-1 rounded-md text-xs text-transparent">
            <div className="h-5 w-5" />
            <span className="mt-0.5">-</span>
          </div>
        )}

        {/* Primary Add */}
        <button
          onClick={primaryAction}
          className="flex flex-col items-center justify-center py-1 rounded-md text-xs text-primary"
          aria-label="Add"
        >
          <PlusCircle className="h-6 w-6" />
          <span className="mt-0.5">Add</span>
        </button>

        {/* More */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center py-1 rounded-md text-xs text-muted-foreground" aria-label="More">
              <MoreHorizontal className="h-5 w-5" />
              <span className="mt-0.5">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader><SheetTitle>More</SheetTitle></SheetHeader>

            <div className="grid grid-cols-2 gap-2 py-3">
              {/* Flavor-specific items */}
              {isDocs && (
                <button
                  className="btn-muted-tile"
                  onClick={() => go("/dashboard?tab=workspace", () => window.dispatchEvent(new CustomEvent("rrd:upload-doc")))}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Global documents
                </button>
              )}

              {isChecks && (
                <button
                  className="btn-muted-tile"
                  onClick={() => go("/dashboard?tab=calendar")}
                  disabled={subscription?.subscriptionPlan === "basic"}
                  title={subscription?.subscriptionPlan === "basic" ? "Advanced feature" : undefined}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Calendar
                </button>
              )}

              {/* Plan & Billing */}
              <button
                className="btn-muted-tile"
                onClick={() => go("/billing")}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Plan & billing
              </button>

              {/* Help */}
              <button
                className="btn-muted-tile"
                onClick={() => go("/help")}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Help & support
              </button>

              {/* Settings -> dashboard profile tab */}
              <button
                className="btn-muted-tile"
                onClick={() => {
                  setOpen(false);
                  if (loc.pathname + loc.search !== "/dashboard?tab=profile") {
                    nav("/dashboard?tab=profile");
                  }
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </button>

              {/* Contact Support */}
              <ContactSupportDialog />
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2 border-t">
              Tip: Use the big "Add" button for common tasks
            </p>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
