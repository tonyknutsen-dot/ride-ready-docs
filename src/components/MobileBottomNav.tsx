import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, FolderOpen, BadgeCheck, PlusCircle, MoreHorizontal, Calendar as CalendarIcon, CreditCard, HelpCircle, Settings, Mail, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/dashboard?tab=workspace", label: "Rides", icon: FolderOpen },
  { to: "/dashboard?tab=calendar", label: "Checks", icon: BadgeCheck },
];

export default function MobileBottomNav() {
  const loc = useLocation();
  const nav = useNavigate();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [open, setOpen] = useState(false);

  // Active matcher
  const isActive = (to: string) => {
    if (to === "/dashboard" && loc.pathname === "/dashboard" && !loc.search) return true;
    if (to.includes("tab=workspace") && loc.search.includes("tab=workspace")) return true;
    if (to.includes("tab=calendar") && loc.search.includes("tab=calendar")) return true;
    return false;
  };

  // Primary action button behaviour (contextual by route)
  const primaryAction = () => {
    const searchParams = new URLSearchParams(loc.search);
    const currentTab = searchParams.get("tab");
    
    if (currentTab === "workspace") {
      // Add new ride
      window.dispatchEvent(new CustomEvent("rrd:add-ride"));
    } else if (currentTab === "documents") {
      // Upload document
      window.dispatchEvent(new CustomEvent("rrd:upload-doc"));
    } else if (currentTab === "calendar") {
      // Start check
      window.dispatchEvent(new CustomEvent("rrd:start-check"));
    } else {
      // Default: go to workspace and add
      nav("/dashboard?tab=workspace");
      setTimeout(() => window.dispatchEvent(new CustomEvent("rrd:add-ride")), 250);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden">
      <div className="mx-auto max-w-screen-sm grid grid-cols-5 gap-1 p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link 
              key={item.to} 
              to={item.to} 
              className={cn(
                "flex flex-col items-center justify-center py-1 rounded-md text-xs transition-colors",
                isActive(item.to) ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}

        {/* Primary Action (contextual) */}
        <button
          onClick={primaryAction}
          className="flex flex-col items-center justify-center py-1 rounded-md text-xs text-primary"
          aria-label="Primary action"
        >
          <PlusCircle className="h-6 w-6" />
          <span className="mt-0.5">Add</span>
        </button>

        {/* More sheet */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center py-1 rounded-md text-xs text-muted-foreground">
              <MoreHorizontal className="h-5 w-5" />
              <span className="mt-0.5">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader>
              <SheetTitle>More Options</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2 py-4">
              <Link 
                to="/billing" 
                className="btn-muted-tile"
                onClick={() => setOpen(false)}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Billing
              </Link>
              {subscription?.subscriptionPlan === "advanced" && (
                <Link 
                  to="/dashboard?tab=calendar" 
                  className="btn-muted-tile"
                  onClick={() => setOpen(false)}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Calendar
                </Link>
              )}
              <Link 
                to="/help" 
                className="btn-muted-tile"
                onClick={() => setOpen(false)}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Help
              </Link>
              <a 
                href="mailto:support@ridereadydocs.com" 
                className="btn-muted-tile"
                onClick={() => setOpen(false)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Support
              </a>
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
