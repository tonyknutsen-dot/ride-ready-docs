import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { brandColors, emailStyles, logoSvg, escapeHtml } from "../_shared/email-template.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";
import { logEmailSend } from "../_shared/email-logger.ts";

interface CreateDocumentShareRequest {
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  documentIds: string[];
  expiryDays?: number;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Check if IP is blocked
    const clientIp = getClientIp(req);
    const blockResult = await checkIpBlocked(clientIp);
    if (blockResult.isBlocked) {
      console.log(`Blocked IP ${clientIp} attempted to access create-document-share`);
      return createBlockedIpResponse(blockResult, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Rate limiting
    const rateLimitKey = getClientIdentifier(req, "create-document-share", user.id);
    const rateLimitResult = await checkRateLimit(rateLimitKey, "batch");
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for user ${user.id}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const {
      recipientEmail,
      recipientName = "Recipient",
      message = "",
      documentIds,
      expiryDays = 7
    }: CreateDocumentShareRequest = await req.json();

    console.log(`Creating document share for ${documentIds.length} documents to ${recipientEmail}`);

    // Get user profile for sender information
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name, controller_name, showmen_name, address, operator_type")
      .eq("user_id", user.id)
      .single();

    const operatorLabel = profile?.operator_type === 'showman' ? 'Showmen' : 'Operator';

    // Get all selected documents with ride info
    const { data: documents, error: docsError } = await supabase
      .from("documents")
      .select(`*, rides:ride_id (ride_name, manufacturer)`)
      .eq("user_id", user.id)
      .in("id", documentIds);

    if (docsError) {
      console.error("Error fetching documents:", docsError);
      throw new Error("Failed to fetch documents");
    }

    if (!documents || documents.length === 0) {
      throw new Error("No documents found");
    }

    // Generate a secure share token
    const shareToken = crypto.randomUUID() + '-' + crypto.randomUUID().slice(0, 8);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Create the document share record
    const { data: share, error: shareError } = await supabase
      .from("document_shares")
      .insert({
        user_id: user.id,
        share_token: shareToken,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        message: message,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (shareError) {
      console.error("Error creating share:", shareError);
      throw new Error("Failed to create document share");
    }

    // Create share items for each document
    const shareItems = documents.map(doc => ({
      share_id: share.id,
      document_id: doc.id,
      file_path: doc.file_path,
      document_name: doc.document_name,
      document_type: doc.document_type,
      ride_name: doc.rides?.ride_name || 'Global'
    }));

    const { error: itemsError } = await supabase
      .from("document_share_items")
      .insert(shareItems);

    if (itemsError) {
      console.error("Error creating share items:", itemsError);
      // Clean up the share record
      await supabase.from("document_shares").delete().eq("id", share.id);
      throw new Error("Failed to create document share items");
    }

    // Generate the download page URL
    const downloadPageUrl = `https://ridereadydocs.com/shared/${shareToken}`;

    // Group documents by ride for email
    const docsByRide = documents.reduce((acc, doc) => {
      const key = doc.rides?.ride_name || 'Global';
      if (!acc[key]) acc[key] = [];
      acc[key].push(doc);
      return acc;
    }, {} as Record<string, typeof documents>);

    const safeCompanyName = escapeHtml(profile?.company_name);
    const safeControllerName = escapeHtml(profile?.controller_name);
    const safeShowmenName = escapeHtml(profile?.showmen_name);
    const safeAddress = escapeHtml(profile?.address);
    const safeUserEmail = escapeHtml(user.email);
    const safeMessage = escapeHtml(message);
    const senderName = safeCompanyName || safeControllerName || "Ride Operator";
    const currentYear = new Date().getFullYear();
    const expiryDateFormatted = expiresAt.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Equipment Documentation Package</title>
</head>
<body style="${emailStyles.body}">
  <div style="${emailStyles.container}">
    <div style="${emailStyles.header}">
      <div style="margin-bottom: 16px;">${logoSvg}</div>
      <h1 style="${emailStyles.headerTitle}">Equipment Documentation</h1>
      <p style="${emailStyles.headerSubtitle}">Secure Download Link</p>
    </div>
    
    <div style="${emailStyles.content}">
      <div style="${emailStyles.infoBox}">
        <p style="${emailStyles.label}">FROM</p>
        ${safeCompanyName ? `<p style="${emailStyles.value}"><strong>Company:</strong> ${safeCompanyName}</p>` : ''}
        ${safeControllerName ? `<p style="${emailStyles.value}"><strong>Controller:</strong> ${safeControllerName}</p>` : ''}
        ${safeShowmenName ? `<p style="${emailStyles.value}; color: ${brandColors.textLight};"><strong>${operatorLabel}:</strong> ${safeShowmenName}</p>` : ''}
        ${safeAddress ? `<p style="${emailStyles.value}; color: ${brandColors.textLight};"><strong>Address:</strong> ${safeAddress}</p>` : ''}
        <p style="${emailStyles.value}; color: ${brandColors.textLight};"><strong>Email:</strong> ${safeUserEmail}</p>
      </div>

      ${safeMessage ? `
        <div style="margin: 24px 0;">
          <p style="${emailStyles.label}">MESSAGE</p>
          <p style="${emailStyles.value}; line-height: 1.8;">${safeMessage}</p>
        </div>
      ` : ''}

      <div style="margin: 24px 0; text-align: center;">
        <a href="${downloadPageUrl}" style="display: inline-block; padding: 14px 32px; background: ${brandColors.primary}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          📥 Download ${documents.length} Document${documents.length !== 1 ? 's' : ''}
        </a>
      </div>

      <div style="${emailStyles.warningBox}">
        <p style="margin: 0; font-weight: 600; color: ${brandColors.text};">⏰ Link expires: ${expiryDateFormatted}</p>
        <p style="margin: 8px 0 0 0; color: ${brandColors.textLight}; font-size: 14px;">This secure link will expire in ${expiryDays} days. Please download the documents before then.</p>
      </div>

      <div style="margin: 24px 0;">
        <p style="${emailStyles.label}">INCLUDED DOCUMENTS</p>
        ${Object.entries(docsByRide).map(([rideName, docs]) => `
          <div style="margin-top: 16px;">
            <p style="font-weight: 600; color: ${brandColors.primary}; margin: 0 0 8px 0;">🎪 ${escapeHtml(rideName)}</p>
            ${(docs as any[]).map(doc => `
              <div style="padding: 12px; margin: 4px 0; background: ${brandColors.background}; border-radius: 6px; border-left: 3px solid ${brandColors.primary};">
                <span style="font-weight: 500;">📄 ${escapeHtml(doc.document_name)}</span>
                <span style="color: ${brandColors.textLight}; font-size: 13px;"> (${escapeHtml(doc.document_type)})</span>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>

      <hr style="${emailStyles.divider}">
      <p style="color: ${brandColors.textLight}; font-size: 14px;">
        This documentation package was sent via Ride Ready Docs. If you have any questions, please contact ${safeControllerName || 'the sender'} directly.
      </p>
    </div>
    
    <div style="${emailStyles.footer}">
      <p style="${emailStyles.footerText}">
        © ${currentYear} Ride Ready Docs. All rights reserved.<br>
        Professional compliance management for amusement equipment.<br><br>
        <a href="https://ridereadydocs.com" style="${emailStyles.footerLink}">ridereadydocs.com</a> · 
        <a href="mailto:info@ridereadydocs.com" style="${emailStyles.footerLink}">info@ridereadydocs.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: [recipientEmail],
      subject: `Equipment Documentation Package - ${senderName}`,
      html: htmlContent
    });

    console.log(`Email sent successfully:`, emailResponse);

    // Log notification
    await supabase
      .from("notifications")
      .insert({
        user_id: user.id,
        title: "Documents Shared",
        message: `Sent download link for ${documents.length} documents to ${recipientEmail}`,
        type: "info"
      });

    return new Response(JSON.stringify({ 
      success: true, 
      shareId: share.id,
      shareToken: shareToken,
      documentsCount: documents.length,
      expiresAt: expiresAt.toISOString(),
      downloadUrl: downloadPageUrl
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in create-document-share function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create document share. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
