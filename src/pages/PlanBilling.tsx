import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";

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
    // Small delay so FeatureGate picks up the change
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
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => nav(-1)}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Plan & Billing</CardTitle>
          <CardDescription>Manage your plan. Downgrading hides advanced features; your data stays.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-3 flex items-center gap-2">
            {plan === "advanced"
              ? <><CheckCircle2 className="text-primary" /><div><b>Current plan:</b> Advanced</div></>
              : <><CheckCircle2 className="text-primary" /><div><b>Current plan:</b> Basic</div></>
            }
          </div>

          {plan === "advanced" ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>After downgrading you'll lose access to: Calendar & Scheduling, Global Documents, and other Advanced-only tools. You can upgrade again later—your data remains.</span>
              </div>
              <Button onClick={downgrade} disabled={saving} className="btn-bold-primary">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Downgrade to Basic
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              You're already on Basic. Advanced features are hidden.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
