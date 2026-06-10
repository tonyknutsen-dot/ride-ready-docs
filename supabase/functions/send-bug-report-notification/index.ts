import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@4.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { logEmailSend } from "../_shared/email-logger.ts";
import { auditedResendSend } from "../_shared/resend-audit.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const FROM = "Ride Ready Docs <noreply@ridereadydocs.co.uk>";
const RECIPIENT = "info@knutssoftware.co.uk";

interface BugReportNotification {
  referenceId: string;
  title: string;
  severity: string;
  issueType?: string;
  appVersion: string;
  currentRoute: string;
  description: string;
  reporterEmail?: string;
  reporterRole?: string;
  deviceType?: string;
  browserInfo?: string;
  hasScreenshot?: boolean;
}

const getSeverityEmoji = (severity: string): string => {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
};

const esc = (s: unknown): string => {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const body: BugReportNotification = await req.json();
    const {
      referenceId, title, severity, issueType, appVersion, currentRoute,
      description, reporterEmail, reporterRole, deviceType, browserInfo, hasScreenshot,
    } = body;

    console.log(`Sending bug report notification for ${referenceId}`);

    // Resolve organisation name (best-effort) using service role
    let organisationName: string | null = null;
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey && reporterEmail) {
        const sb = createClient(supabaseUrl, serviceKey);
        const { data: users } = await sb.auth.admin.listUsers();
        const found = users?.users?.find((u: any) => u.email?.toLowerCase() === reporterEmail.toLowerCase());
        if (found) {
          const { data: org } = await sb.from('organisations').select('name').eq('owner_id', found.id).maybeSingle();
          if (org?.name) {
            organisationName = org.name;
          } else {
            const { data: member } = await sb
              .from('organisation_members')
              .select('organisation_id, organisations(name)')
              .eq('user_id', found.id)
              .eq('is_active', true)
              .maybeSingle();
            organisationName = (member as any)?.organisations?.name || null;
          }
        }
      }
    } catch (orgErr) {
      console.warn('Failed to resolve organisation:', orgErr);
    }

    const sevEmoji = getSeverityEmoji(severity);
    const subject = `New Ride Ready Docs problem report: ${referenceId}`;
    const adminLink = `https://ridereadydocs.com/admin/bug-reports?ref=${encodeURIComponent(referenceId)}`;

    const sevColor = severity === 'critical' ? '#ef4444'
      : severity === 'high' ? '#f97316'
      : severity === 'medium' ? '#eab308'
      : '#22c55e';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #0f172a;">
        <h1 style="margin: 0 0 8px; font-size: 20px;">${sevEmoji} New problem report</h1>
        <p style="margin: 0 0 20px; color: #64748b; font-size: 14px;">Reference <strong>${esc(referenceId)}</strong></p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; background: #f8fafc; border-radius: 8px; padding: 12px;">
          <tbody>
            <tr><td style="padding: 6px 10px; color: #64748b; width: 180px;">Title</td><td style="padding: 6px 10px; font-weight: 600;">${esc(title)}</td></tr>
            <tr><td style="padding: 6px 10px; color: #64748b;">Severity</td><td style="padding: 6px 10px;"><span style="background:${sevColor};color:#fff;padding:2px 10px;border-radius:4px;font-size:12px;text-transform:uppercase;">${esc(severity)}</span></td></tr>
            <tr><td style="padding: 6px 10px; color: #64748b;">Issue type</td><td style="padding: 6px 10px;">${esc(issueType)}</td></tr>
            <tr><td style="padding: 6px 10px; color: #64748b;">Reporter email</td><td style="padding: 6px 10px;">${esc(reporterEmail)}</td></tr>
            <tr><td style="padding: 6px 10px; color: #64748b;">Reporter role</td><td style="padding: 6px 10px;">${esc(reporterRole)}</td></tr>
            <tr><td style="padding: 6px 10px; color: #64748b;">Organisation</td><td style="padding: 6px 10px;">${esc(organisationName)}</td></tr>
            <tr><td style="padding: 6px 10px; color: #64748b;">Reported route</td><td style="padding: 6px 10px; font-family: monospace;">${esc(currentRoute)}</td></tr>
            <tr><td style="padding: 6px 10px; color: #64748b;">App version</td><td style="padding: 6px 10px; font-family: monospace;">${esc(appVersion)}</td></tr>
            <tr><td style="padding: 6px 10px; color: #64748b;">Device</td><td style="padding: 6px 10px;">${esc(deviceType)}</td></tr>
            <tr><td style="padding: 6px 10px; color: #64748b;">Browser</td><td style="padding: 6px 10px;">${esc(browserInfo)}</td></tr>
            <tr><td style="padding: 6px 10px; color: #64748b;">Screenshot</td><td style="padding: 6px 10px;">${hasScreenshot ? 'Yes' : 'No'}</td></tr>
          </tbody>
        </table>

        <h3 style="margin: 24px 0 8px; font-size: 15px;">Description</h3>
        <p style="color: #334155; line-height: 1.6; white-space: pre-wrap; margin: 0;">${esc(description)}</p>

        <p style="margin: 24px 0 0;">
          <a href="${adminLink}" style="display:inline-block;background:#1E3A5F;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Open in admin</a>
        </p>
      </div>
    `;

    await auditedResendSend(resend, {
      from: FROM,
      to: [RECIPIENT],
      subject,
      html,
    }, {
      function_name: 'send-bug-report-notification',
      template_name: 'bug-report-notification',
      metadata: {
        reference_id: referenceId,
        severity,
        issue_type: issueType,
        app_version: appVersion,
        reporter_email: reporterEmail,
        reporter_role: reporterRole,
        organisation_name: organisationName,
        route: currentRoute,
        has_screenshot: !!hasScreenshot,
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending bug report notification:", error);

    await logEmailSend({
      template_name: 'bug-report-notification',
      recipient_email: RECIPIENT,
      status: 'failed',
      error_message: error?.message || String(error),
    }).catch(() => {});

    // Return 200 so caller flow (bug report save) is never considered failed.
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
