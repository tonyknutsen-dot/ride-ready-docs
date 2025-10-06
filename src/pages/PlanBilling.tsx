import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle2, AlertTriangle, Crown, Receipt } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type Profile = {
  user_id: string;
  subscription_status: string | null;
  subscription_plan: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
};

export default function PlanBilling() {
  const { user } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, subscription_status, subscription_plan, trial_started_at, trial_ends_at")
        .eq("user_id", user.id)
        .single();
      if (error) {
        toast({ title: "Couldn't load plan", description: error.message, variant: "destructive" });
      } else {
        setProfile(data);
      }
      setLoading(false);
    })();
  }, [user, toast]);

  const upgrade = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        subscription_status: "advanced",
        subscription_plan: "advanced",
        trial_started_at: null,
        trial_ends_at: null,
      })
      .eq("user_id", user.id);
    setSaving(false);

    if (error) {
      toast({ title: "Couldn't upgrade", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Upgraded to Advanced!", description: "All features are now unlocked.", variant: "default" });
    setTimeout(() => nav("/dashboard"), 400);
  };

  const downgrade = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        subscription_status: "basic",
        subscription_plan: "basic",
        trial_started_at: null,
        trial_ends_at: null,
      })
      .eq("user_id", user.id);
    setSaving(false);

    if (error) {
      toast({ title: "Couldn't downgrade", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "You're on Basic now", description: "Advanced features will be hidden.", variant: "default" });
    setTimeout(() => nav("/dashboard"), 400);
  };

  if (loading) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={() => nav(-1)} className="mb-3"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Card><CardContent className="py-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading…
        </CardContent></Card>
      </div>
    );
  }

  const plan = profile?.subscription_plan ?? "basic";

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-20 md:pb-4">
      <Button variant="ghost" onClick={() => nav(-1)}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>

      {/* Current Plan Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {plan === "advanced" ? <Crown className="w-5 h-5 text-amber-500" /> : null}
            Plan & Billing
          </CardTitle>
          <CardDescription>Manage your subscription plan and view billing history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-primary" />
              <div>
                <div className="font-semibold">{plan === "advanced" ? "Documents + Operations Plan" : "Documents Plan"}</div>
                <div className="text-sm text-muted-foreground">
                  {plan === "advanced" 
                    ? "Document storage + operations & maintenance features" 
                    : "Essential document storage for ride management"}
                </div>
              </div>
            </div>
            {plan === "advanced" && <Crown className="w-6 h-6 text-amber-500" />}
          </div>

          <Separator />

          {plan === "basic" ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-3">
                <div className="font-medium flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" />
                  Upgrade to Advanced Plan
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  Full Operations & Maintenance features
                </div>
                <div className="text-sm space-y-2">
                  <div className="font-medium text-foreground">Everything in Documents Plan, plus:</div>
                  <div className="text-muted-foreground space-y-1">
                    <div>• Daily, monthly & yearly checks</div>
                    <div>• Inspection management & scheduling</div>
                    <div>• NDT testing schedules</div>
                    <div>• Maintenance tracking</div>
                    <div>• Calendar & scheduling system</div>
                    <div>• Notifications & alerts</div>
                    <div>• Advanced reporting & analytics</div>
                    <div>• Technical bulletins library</div>
                    <div>• Risk assessment builder (downloadable, printable, emailable)</div>
                  </div>
                </div>
              </div>
              <Button onClick={upgrade} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crown className="w-4 h-4 mr-2" />}
                Upgrade to Advanced Plan
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Downgrading will hide Operations & Maintenance features like checks, inspections, maintenance tracking, calendar, notifications, reports, technical bulletins, and risk assessments. Your data remains safe and can be accessed again by upgrading.</span>
              </div>
              <Button onClick={downgrade} disabled={saving} variant="outline">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Downgrade to Documents Plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Billing History
          </CardTitle>
          <CardDescription>View your invoices and payment history.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Receipt className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              No billing history yet. When payment processing is enabled, your invoices will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
