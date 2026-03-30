import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { logEmailSend } from "../_shared/email-logger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface BugReportNotification {
  referenceId: string;
  title: string;
  severity: string;
  appVersion: string;
  currentRoute: string;
  description: string;
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

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const { referenceId, title, severity, appVersion, currentRoute, description }: BugReportNotification = await req.json();

    console.log(`Sending bug report notification for ${referenceId}`);

    const severityEmoji = getSeverityEmoji(severity);
    
    const emailResponse = await resend.emails.send({
      from: "Ride Ready <onboarding@resend.dev>",
      to: ["info@knutssoftware.co.uk"],
      subject: `${severityEmoji} Bug Report ${referenceId}: ${title}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #ef4444; margin-bottom: 24px;">🐛 New Bug Report</h1>
          
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; width: 120px;">Reference:</td>
                <td style="padding: 8px 0; font-weight: 600;">${referenceId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Severity:</td>
                <td style="padding: 8px 0;">
                  <span style="background-color: ${severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f97316' : severity === 'medium' ? '#eab308' : '#22c55e'}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">
                    ${severity}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Version:</td>
                <td style="padding: 8px 0; font-family: monospace;">${appVersion}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Page:</td>
                <td style="padding: 8px 0; font-family: monospace;">${currentRoute}</td>
              </tr>
            </table>
          </div>

          <h2 style="color: #1e293b; font-size: 18px; margin-bottom: 12px;">${title}</h2>
          
          <p style="color: #475569; line-height: 1.6; white-space: pre-wrap;">${description}</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          
          <p style="color: #94a3b8; font-size: 12px;">
            View and manage this bug report in the admin panel.
          </p>
        </div>
      `,
    });

    console.log("Bug report notification sent:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending bug report notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
