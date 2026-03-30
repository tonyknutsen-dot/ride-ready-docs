import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";
import { logEmailSend } from "../_shared/email-logger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Brand colors
const primary = '#1e4a8f';
const primaryLight = '#2563eb';

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

interface SupportResponseRequest {
  messageId: string;
  adminResponse: string;
  userEmail: string;
  subject: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Check if IP is blocked
  const clientIp = getClientIp(req);
  const blockResult = await checkIpBlocked(clientIp);
  if (blockResult.isBlocked) {
    console.log(`Blocked IP ${clientIp} attempted to access send-support-response`);
    return createBlockedIpResponse(blockResult, corsHeaders);
  }

  try {
    const { messageId, adminResponse, userEmail, subject }: SupportResponseRequest = await req.json();

    if (!userEmail || !adminResponse || !subject) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const safeSubject = escapeHtml(subject);
    const safeResponse = escapeHtml(adminResponse).replace(/\n/g, '<br>');
    const currentYear = new Date().getFullYear();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support Response</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${primary} 0%, ${primaryLight} 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Support Response</h1>
      <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">We've responded to your enquiry</p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
      <p style="margin-top: 0; font-size: 16px;">Hello,</p>
      
      <p style="font-size: 15px;">Thank you for contacting us. Here is our response to your support request:</p>
      
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Your Enquiry</p>
        <p style="margin: 0; font-size: 15px; color: ${primary}; font-weight: 600;">${safeSubject}</p>
      </div>
      
      <div style="background: #eff6ff; border-left: 4px solid ${primary}; padding: 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${primary};">Our Response</p>
        <p style="margin: 0; font-size: 15px; line-height: 1.7;">${safeResponse}</p>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      
      <p style="font-size: 15px; margin-bottom: 0;">If you have any further questions, please reply to this email or contact us at <a href="mailto:info@ridereadydocs.com" style="color: ${primary}; text-decoration: none;">info@ridereadydocs.com</a></p>
      
      <p style="margin-top: 24px; margin-bottom: 0;">Best regards,<br><strong>The Ride Ready Docs Team</strong></p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f9fafb; padding: 30px 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.8;">
        © ${currentYear} Ride Ready Docs. All rights reserved.<br>
        <a href="https://ridereadydocs.com" style="color: ${primary}; text-decoration: none;">ridereadydocs.com</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs Support <info@ridereadydocs.com>",
      to: [userEmail],
      subject: `Re: ${subject}`,
      html,
    });

    console.log("Support response email sent successfully:", emailResponse);

    await logEmailSend({
      template_name: 'support-response',
      recipient_email: userEmail,
      subject: `Re: ${subject}`,
      status: 'sent',
      message_id: emailResponse?.data?.id || undefined,
    });

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending support response email:", error);

    await logEmailSend({
      template_name: 'support-response',
      recipient_email: userEmail || 'unknown',
      status: 'failed',
      error_message: error.message,
    }).catch(() => {});

    return new Response(
      JSON.stringify({ error: "Failed to send email. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
