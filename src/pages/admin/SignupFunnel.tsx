import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FunnelRow {
  id: string;
  event_name: string;
  email: string | null;
  page_path: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  error_message: string | null;
  created_at: string;
}

const EVENT_ORDER = [
  "landing_page_view",
  "cta_click",
  "pricing_click",
  "signup_page_view",
  "signup_submit_attempt",
  "signup_success",
  "signup_failure",
  "onboarding_completed",
] as const;

const EVENT_LABEL: Record<string, string> = {
  landing_page_view: "Landing views",
  cta_click: "CTA clicks",
  pricing_click: "Pricing clicks",
  signup_page_view: "Signup page views",
  signup_submit_attempt: "Signup attempts",
  signup_success: "Signups completed",
  signup_failure: "Signup failures",
  onboarding_completed: "Onboarding completed",
};

export default function SignupFunnel() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [failures, setFailures] = useState<FunnelRow[]>([]);
  const [recent, setRecent] = useState<FunnelRow[]>([]);
  const [windowDays, setWindowDays] = useState(7);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from("signup_funnel_events")
        .select("id,event_name,email,page_path,referrer,utm_source,utm_medium,utm_campaign,error_message,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (cancelled) return;
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      const rows: FunnelRow[] = data || [];
      const c: Record<string, number> = {};
      for (const r of rows) c[r.event_name] = (c[r.event_name] || 0) + 1;
      setCounts(c);
      setFailures(rows.filter(r => r.event_name === "signup_failure").slice(0, 25));
      setRecent(rows.slice(0, 50));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [windowDays]);

  const pct = (a: number, b: number) =>
    b > 0 ? `${Math.round((a / b) * 100)}%` : "—";

  const landing = counts.landing_page_view || 0;
  const ctas = (counts.cta_click || 0) + (counts.pricing_click || 0);
  const signupView = counts.signup_page_view || 0;
  const attempts = counts.signup_submit_attempt || 0;
  const success = counts.signup_success || 0;

  return (
    <div className="container mx-auto px-3 py-4 space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Signup Funnel</h1>
          <p className="text-sm text-muted-foreground">Visitor → signup conversion over the last {windowDays} days.</p>
        </div>
        <div className="flex gap-1">
          {[1, 7, 30].map(d => (
            <button
              key={d}
              onClick={() => setWindowDays(d)}
              className={`px-3 py-1.5 text-xs rounded-md border ${windowDays === d ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {EVENT_ORDER.map(ev => (
              <Card key={ev}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{EVENT_LABEL[ev]}</div>
                  <div className="text-2xl font-bold mt-1">{counts[ev] || 0}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Conversion</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-muted-foreground">Landing → any CTA</div><div className="font-semibold">{pct(ctas, landing)}</div></div>
              <div><div className="text-muted-foreground">CTA → signup page</div><div className="font-semibold">{pct(signupView, ctas)}</div></div>
              <div><div className="text-muted-foreground">Signup page → attempt</div><div className="font-semibold">{pct(attempts, signupView)}</div></div>
              <div><div className="text-muted-foreground">Attempt → success</div><div className="font-semibold">{pct(success, attempts)}</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent signup failures</CardTitle></CardHeader>
            <CardContent>
              {failures.length === 0 ? (
                <p className="text-sm text-muted-foreground">No failures in this window.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {failures.map(f => (
                    <li key={f.id} className="border-l-2 border-destructive pl-3">
                      <div className="font-medium">{f.email || "(no email)"}</div>
                      <div className="text-destructive text-xs">{f.error_message || "Unknown error"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent events</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {recent.map(r => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 border-b pb-2">
                    <Badge variant="secondary" className="text-[10px]">{r.event_name}</Badge>
                    {r.email && <span className="text-xs">{r.email}</span>}
                    {r.page_path && <span className="text-xs text-muted-foreground">{r.page_path}</span>}
                    {(r.utm_source || r.referrer) && (
                      <span className="text-xs text-muted-foreground">
                        {r.utm_source ? `utm:${r.utm_source}` : `ref:${(r.referrer || "").slice(0, 40)}`}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
