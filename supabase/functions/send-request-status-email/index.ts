import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand colors
const primary = '#1e4a8f';
const primaryLight = '#2563eb';
const success = '#16a34a';
const danger = '#dc2626';

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

interface RequestStatusEmailRequest {
  userEmail: string;
  requestType: 'ride_type' | 'document_type';
  requestName: string;
  status: 'approved' | 'rejected';
  adminNotes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, requestType, requestName, status, adminNotes }: RequestStatusEmailRequest = await req.json();

    if (!userEmail || !requestType || !requestName || !status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const isApproved = status === 'approved';
    const typeLabel = requestType === 'ride_type' ? 'Ride Type' : 'Document Type';
    const statusColor = isApproved ? success : danger;
    const statusLabel = isApproved ? 'Approved' : 'Rejected';
    const statusIcon = isApproved ? '✓' : '✗';
    const currentYear = new Date().getFullYear();

    console.log(`Sending ${status} email for ${requestType} request: ${requestName} to ${userEmail}`);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Request ${statusLabel}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${primary} 0%, ${primaryLight} 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">${typeLabel} Request Update</h1>
      <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">Your request has been reviewed</p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
      <p style="margin-top: 0; font-size: 16px;">Hello,</p>
      
      <p style="font-size: 15px;">Your request for a new ${typeLabel.toLowerCase()} has been reviewed by our team.</p>
      
      <div style="background: ${isApproved ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isApproved ? '#bbf7d0' : '#fecaca'}; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <div style="width: 48px; height: 48px; background: ${statusColor}; border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: 24px; font-weight: bold;">${statusIcon}</span>
        </div>
        <p style="margin: 0; font-size: 18px; font-weight: 700; color: ${statusColor};">${statusLabel}</p>
      </div>
      
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <div style="margin-bottom: 12px;">
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Request</p>
          <p style="margin: 0; font-size: 16px; font-weight: 600; color: ${primary};">${escapeHtml(requestName)}</p>
        </div>
        <div>
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Type</p>
          <p style="margin: 0; font-size: 14px;">${typeLabel}</p>
        </div>
      </div>
      
      ${adminNotes ? `
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e;">Admin Notes</p>
        <p style="margin: 0; font-size: 15px; color: #78350f;">${escapeHtml(adminNotes)}</p>
      </div>
      ` : ''}
      
      ${isApproved ? `
      <div style="background: #f0fdf4; border-left: 4px solid ${success}; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
        <p style="margin: 0; font-size: 15px; color: #166534;">The requested ${typeLabel.toLowerCase()} will be added to the system shortly. You'll be able to use it when adding new rides or documents.</p>
      </div>
      ` : `
      <p style="font-size: 15px;">If you have questions about this decision, please contact our support team through the app or email us directly.</p>
      `}
      
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
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: [userEmail],
      subject: `${isApproved ? '✓' : '✗'} Your ${typeLabel} Request has been ${statusLabel}`,
      html,
    });

    console.log("Request status email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending request status email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send email. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
