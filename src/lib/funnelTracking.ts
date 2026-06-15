/**
 * Lightweight, non-blocking signup funnel tracking.
 *
 * - Never throws; never blocks the caller.
 * - Stores no passwords or sensitive data.
 * - Uses an anonymous session id from localStorage, linked to user_id after signup.
 */
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "rrd_anon_session_id";
const UTM_KEY = "rrd_utm_snapshot";

export type FunnelEventName =
  | "landing_page_view"
  | "cta_click"
  | "pricing_click"
  | "signup_page_view"
  | "signup_submit_attempt"
  | "signup_success"
  | "signup_failure"
  | "onboarding_completed";

function getAnonSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        (crypto as any)?.randomUUID?.() ||
        `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `anon_${Date.now()}`;
  }
}

function readUtm(): {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  referrer?: string | null;
} {
  try {
    // Capture from URL on first call this session, then persist
    const params = new URLSearchParams(window.location.search);
    const fromUrl = {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
    };
    let stored: any = {};
    try {
      stored = JSON.parse(sessionStorage.getItem(UTM_KEY) || "{}");
    } catch {}
    const merged = {
      utm_source: fromUrl.utm_source || stored.utm_source || null,
      utm_medium: fromUrl.utm_medium || stored.utm_medium || null,
      utm_campaign: fromUrl.utm_campaign || stored.utm_campaign || null,
      referrer: stored.referrer || document.referrer || null,
    };
    try {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(merged));
    } catch {}
    return merged;
  } catch {
    return {};
  }
}

export interface TrackOptions {
  email?: string | null;
  userId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

export function trackFunnelEvent(
  event_name: FunnelEventName,
  opts: TrackOptions = {}
): void {
  // Fire-and-forget; never await, never throw
  try {
    const anonymous_session_id = getAnonSessionId();
    const utm = readUtm();
    const page_path =
      typeof window !== "undefined" ? window.location.pathname : null;
    const user_agent =
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null;

    void (supabase as any)
      .from("signup_funnel_events")
      .insert({
        event_name,
        anonymous_session_id,
        user_id: opts.userId ?? null,
        email: opts.email ?? null,
        page_path,
        referrer: utm.referrer ?? null,
        utm_source: utm.utm_source ?? null,
        utm_medium: utm.utm_medium ?? null,
        utm_campaign: utm.utm_campaign ?? null,
        user_agent,
        error_message: opts.errorMessage ?? null,
        metadata: opts.metadata ?? {},
      })
      .then(() => {}, () => {});
  } catch {
    /* swallow */
  }
}
