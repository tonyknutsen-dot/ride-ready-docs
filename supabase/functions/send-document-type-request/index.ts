import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse } from "../_shared/rate-limit.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Brand colors
const primary = '#1e4a8f';
const primaryLight = '#2563eb';

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

interface DocumentTypeRequest {
  documentTypeName: string;
  description?: string;
  justification?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const { documentTypeName, description, justification }: DocumentTypeRequest = await req.json();

    if (!documentTypeName?.trim()) {
      return new Response(
        JSON.stringify({ error: "Document type name is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Rate limiting - public requests get stricter limits
    const rateLimitKey = getClientIdentifier(req, "send-document-type-request");
    const rateLimitResult = checkRateLimit(rateLimitKey, "email");
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const safeDocumentTypeName = escapeHtml(documentTypeName);
    const safeDescription = escapeHtml(description);
    const safeJustification = escapeHtml(justification);
    const currentYear = new Date().getFullYear();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Document Type Request</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${primary} 0%, ${primaryLight} 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">📋 New Document Type Request</h1>
      <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">A user has requested a new document type</p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
      <div style="background: #eff6ff; border-left: 4px solid ${primary}; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${primary};">Requested Document Type</p>
        <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1f2937;">${safeDocumentTypeName}</p>
      </div>

      ${safeDescription ? `
      <div style="margin-bottom: 20px;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Description</p>
        <p style="margin: 0; font-size: 15px; line-height: 1.6;">${safeDescription}</p>
      </div>
      ` : ''}

      ${safeJustification ? `
      <div style="margin-bottom: 20px;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Justification</p>
        <p style="margin: 0; font-size: 15px; line-height: 1.6;">${safeJustification}</p>
      </div>
      ` : ''}

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-top: 24px;">
        <h4 style="margin: 0 0 12px 0; color: ${primary}; font-size: 14px;">Action Required</h4>
        <ol style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px;">
          <li style="margin-bottom: 8px;">Review the requested document type</li>
          <li style="margin-bottom: 8px;">If approved, add it to the document types in the system</li>
          <li style="margin-bottom: 0;">Consider reaching out if clarification is needed</li>
        </ol>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        <a href="https://ridereadydocs.com/admin/document-requests" style="display: inline-block; background: linear-gradient(135deg, ${primary} 0%, ${primaryLight} 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View in Admin Panel</a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #f9fafb; padding: 30px 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        © ${currentYear} Ride Ready Docs Admin Notification
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: ["info@ridereadydocs.com"],
      subject: `📋 New Document Type Request: ${safeDocumentTypeName}`,
      html,
    });

    console.log("Document type request email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, messageId: emailResponse.data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-document-type-request function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
