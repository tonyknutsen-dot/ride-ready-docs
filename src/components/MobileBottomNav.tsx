import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, FolderOpen, CheckSquare, MoreHorizontal,
  Calendar as CalendarIcon, CreditCard, HelpCircle, Settings, FileText, PlusCircle, ShieldCheck, LogOut, Send
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ContactSupportDialog } from "@/components/ContactSupportDialog";
import { QuickDocumentUpload } from "@/components/QuickDocumentUpload";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Routes where the mobile nav should NOT appear (public pages)
const PUBLIC_ROUTES = ['/', '/auth', '/demo', '/how-it-works', '/privacy', '/terms', '/help', '/security'];

export default function MobileBottomNav() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 md:hidden safe-area-pb">
      <div className="mx-auto max-w-screen-sm grid grid-cols-5 gap-1 px-2 py-1">
        {/* Overview */}
        <NavButton 
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            go("/overview");
          }}
          active={isActive(["/overview"])}
          icon={Home}
          label="Home"
        />

        {/* Rides/Equipment */}
        <NavButton 
          onClick={() => go("/rides")}
          active={isActive(["/rides"])}
          icon={FolderOpen}
          label="Rides"
        />

        {/* CHECKS - Central prominent button */}
        <NavButton 
          onClick={() => go("/checks")}
          active={isActive(["/checks"])}
          icon={CheckSquare}
          label="Checks"
          highlight={true}
        />

        {/* Calendar */}
        <NavButton 
          onClick={() => go("/calendar")}
          active={isActive(["/calendar"])}
          icon={CalendarIcon}
          label="Calendar"
        />

        {/* More - Simplified sheet */}
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
          <SheetContent side="bottom" className="max-h-[60vh] rounded-t-3xl px-6 pb-8">
            <SheetHeader className="pb-6">
              <SheetTitle className="text-left text-lg">Quick Access</SheetTitle>
            </SheetHeader>

            <div className="space-y-6">
              {/* Primary Actions - Large touch targets */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  className="flex flex-col items-center gap-2 p-4 bg-primary/5 border border-primary/20 rounded-2xl text-sm font-medium hover:bg-primary/10 transition-all active:scale-95"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <PlusCircle className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-xs">Upload</span>
                </button>
                <button
                  className="flex flex-col items-center gap-2 p-4 bg-success/5 border border-success/20 rounded-2xl text-sm font-medium hover:bg-success/10 transition-all active:scale-95"
                  onClick={() => go("/risk-assessments")}
                >
                  <div className="p-3 bg-success/10 rounded-xl">
                    <ShieldCheck className="h-6 w-6 text-success" />
                  </div>
                  <span className="text-xs">Risk</span>
                </button>
                <button
                  className="flex flex-col items-center gap-2 p-4 bg-muted border border-border/50 rounded-2xl text-sm font-medium hover:bg-muted/80 transition-all active:scale-95"
                  onClick={() => go("/global-documents")}
                >
                  <div className="p-3 bg-background rounded-xl">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span className="text-xs">Docs</span>
                </button>
              </div>

              {/* Secondary Actions - Compact list */}
              <div className="flex flex-wrap gap-2">
                <button
                  className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-xl text-sm hover:bg-muted transition-all active:scale-95"
                  onClick={() => go("/send-documents")}
                >
                  <Send className="h-4 w-4" />
                  <span>Send Docs</span>
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-xl text-sm hover:bg-muted transition-all active:scale-95"
                  onClick={() => go("/billing")}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Billing</span>
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-xl text-sm hover:bg-muted transition-all active:scale-95"
                  onClick={() => go("/settings")}
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-xl text-sm hover:bg-muted transition-all active:scale-95"
                  onClick={() => go("/help")}
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Help</span>
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-3 bg-destructive/10 text-destructive rounded-xl text-sm hover:bg-destructive/20 transition-all active:scale-95"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>

              {/* Support at bottom */}
              <div className="pt-2 border-t border-border/50">
                <ContactSupportDialog />
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
    </div>
  );
}