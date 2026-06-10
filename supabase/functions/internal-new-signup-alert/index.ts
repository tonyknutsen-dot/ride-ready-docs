import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { auditedResendSend } from "../_shared/resend-audit.ts";
import { logEmailSend } from "../_shared/email-logger.ts";

const RECIPIENT = "info@knutssoftware.co.uk";
const FROM = "Ride Ready Docs <noreply@ridereadydocs.co.uk>";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

function esc(s: unknown): string {
  if (s === null || s === undefined) return "—";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const body = await req.json();
    const { email, source } = body ?? {};
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[internal-new-signup-alert] invoked", { email, source: source || "client" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const lowerEmail = email.toLowerCase();

    // Skip entirely if this email belongs to a staff invite (controller-only alert).
    const { data: staffInvite } = await supabase
      .from("staff_invites")
      .select("id")
      .eq("email", lowerEmail)
      .in("status", ["pending", "accepted"])
      .limit(1)
      .maybeSingle();

    if (staffInvite) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "staff_invite" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Dedup: skip if we already successfully sent this alert for this email.
    const { data: priorSent } = await supabase
      .from("email_send_log")
      .select("id")
      .eq("template_name", "internal-new-signup-alert")
      .eq("status", "sent")
      .contains("metadata", { new_user_email: lowerEmail })
      .limit(1)
      .maybeSingle();

    if (priorSent) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "already_sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Look up auth user + profile + organisation + role
    let userId: string | null = null;
    let fullName: string | null = null;
    let country: string | null = null;
    try {
      const { data: list } = await supabase.auth.admin.listUsers();
      const found = list?.users?.find((u: any) => u.email?.toLowerCase() === lowerEmail);
      if (found) {
        userId = found.id;
        fullName = (found.user_metadata?.full_name as string) || null;
        country = (found.user_metadata?.country as string) || null;
      }
    } catch (e) {
      console.warn("[internal-new-signup-alert] auth lookup failed", e);
    }

    let profile: any = null;
    let organisation: any = null;
    let role: string | null = null;
    if (userId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id, company_name, country, trial_started_at, trial_ends_at, subscription_status, subscription_plan, created_at")
        .eq("user_id", userId)
        .maybeSingle();
      profile = prof;
      if (prof) {
        country = country || prof.country || null;
      }
      const { data: org } = await supabase
        .from("organisations")
        .select("id, name")
        .eq("owner_id", userId)
        .maybeSingle();
      organisation = org;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (roles && roles.length > 0) {
        role = roles.map((r: any) => r.role).join(", ");
      } else {
        role = organisation ? "controller" : "user";
      }
    }

    const adminBase = "https://ridereadydocs.com/admin/users";
    const adminLink = userId ? `${adminBase}?user=${encodeURIComponent(userId)}` : adminBase;
    const now = new Date().toISOString();
    const subject = `New Ride Ready Docs signup: ${email}`;
    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
        <h2 style="margin: 0 0 16px;">New Ride Ready Docs signup</h2>
        <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
          <tbody>
            <tr><td style="padding: 6px 8px; color: #555;">Name</td><td style="padding: 6px 8px;"><strong>${esc(fullName)}</strong></td></tr>
            <tr><td style="padding: 6px 8px; color: #555;">Email</td><td style="padding: 6px 8px;"><strong>${esc(email)}</strong></td></tr>
            <tr><td style="padding: 6px 8px; color: #555;">Organisation</td><td style="padding: 6px 8px;">${esc(organisation?.name || profile?.company_name)}</td></tr>
            <tr><td style="padding: 6px 8px; color: #555;">Role</td><td style="padding: 6px 8px;">${esc(role)}</td></tr>
            <tr><td style="padding: 6px 8px; color: #555;">Country</td><td style="padding: 6px 8px;">${esc(country)}</td></tr>
            <tr><td style="padding: 6px 8px; color: #555;">Signup time</td><td style="padding: 6px 8px;">${esc(now)}</td></tr>
            <tr><td style="padding: 6px 8px; color: #555;">Trial start</td><td style="padding: 6px 8px;">${esc(profile?.trial_started_at)}</td></tr>
            <tr><td style="padding: 6px 8px; color: #555;">Trial end</td><td style="padding: 6px 8px;">${esc(profile?.trial_ends_at)}</td></tr>
            <tr><td style="padding: 6px 8px; color: #555;">Plan</td><td style="padding: 6px 8px;">${esc(profile?.subscription_plan)}</td></tr>
            <tr><td style="padding: 6px 8px; color: #555;">Status</td><td style="padding: 6px 8px;">${esc(profile?.subscription_status)}</td></tr>
            <tr><td style="padding: 6px 8px; color: #555;">Profile ID</td><td style="padding: 6px 8px;"><code>${esc(userId)}</code></td></tr>
            <tr><td style="padding: 6px 8px; color: #555;">Organisation ID</td><td style="padding: 6px 8px;"><code>${esc(organisation?.id)}</code></td></tr>
          </tbody>
        </table>
        <p style="margin: 20px 0 0;">
          <a href="${adminLink}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px;">View in admin</a>
        </p>
      </div>
    `;

    try {
      await auditedResendSend(
        resend,
        { from: FROM, to: [RECIPIENT], subject, html },
        {
          function_name: "internal-new-signup-alert",
          template_name: "internal-new-signup-alert",
          user_id: userId || undefined,
          metadata: {
            new_user_email: lowerEmail,
            organisation_id: organisation?.id || null,
            role,
            plan: profile?.subscription_plan || null,
            status: profile?.subscription_status || null,
          },
        },
      );
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (sendErr: any) {
      console.error("[internal-new-signup-alert] send failed", sendErr);
      await logEmailSend({
        template_name: "internal-new-signup-alert",
        recipient_email: RECIPIENT,
        subject,
        status: "failed",
        error_message: sendErr?.message || String(sendErr),
        user_id: userId || undefined,
        metadata: { new_user_email: lowerEmail, phase: "exception_outer" },
      }).catch(() => {});
      // Non-blocking: still return 200 so signup flow is never affected
      return new Response(JSON.stringify({ ok: false, error: "send_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err: any) {
    console.error("[internal-new-signup-alert] error", err);
    return new Response(JSON.stringify({ ok: false, error: err?.message || "error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
