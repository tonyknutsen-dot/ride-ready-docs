import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { brandColors, emailStyles, logoSvg, escapeHtml } from "../_shared/email-template.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface SendDocumentsRequest {
  rideId: string;
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  includeInsurance: boolean;
  documentIds: string[];
}

interface EmailBatch {
  attachments: any[];
  totalSize: number;
  documentNames: string[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
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

    const {
      rideId,
      recipientEmail,
      recipientName = "Recipient",
      message = "",
      includeInsurance,
      documentIds
    }: SendDocumentsRequest = await req.json();

    // Get ride information
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("ride_name, manufacturer, serial_number, year_manufactured")
      .eq("id", rideId)
      .eq("user_id", user.id)
      .single();

    if (rideError || !ride) {
      throw new Error("Ride not found");
    }

    // Get user profile for sender information
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name, controller_name, showmen_name, address, operator_type")
      .eq("user_id", user.id)
      .single();

    const operatorLabel = profile?.operator_type === 'showman' ? 'Showmen' : 'Operator';

    // Get ride-specific documents
    const { data: rideDocuments, error: rideDocsError } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .eq("ride_id", rideId)
      .in("id", documentIds);

    if (rideDocsError) {
      throw new Error("Failed to fetch ride documents");
    }

    // Get insurance documents if requested
    let insuranceDocuments: any[] = [];
    if (includeInsurance) {
      const { data: insurance } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_global", true)
        .ilike("document_type", "%insurance%");
      
      insuranceDocuments = insurance || [];
    }

    const allDocuments = [...(rideDocuments || []), ...insuranceDocuments];

    // Download documents from storage and prepare attachments
    const attachments = [];
    for (const doc of allDocuments) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("ride-documents")
          .download(doc.file_path);

        if (!downloadError && fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          const fileExtension = doc.file_path.split('.').pop();
          const fileName = `${ride.ride_name}_${doc.document_name}.${fileExtension}`;
          
          attachments.push({
            filename: fileName,
            content: base64,
            type: doc.mime_type || "application/octet-stream",
            size: arrayBuffer.byteLength,
            documentName: doc.document_name,
            documentType: doc.document_type,
            expiresAt: doc.expires_at
          });
        }
      } catch (error) {
        console.error(`Failed to download document ${doc.document_name}:`, error);
      }
    }

    // Split attachments into batches if total size exceeds 10MB
    const maxEmailSize = 10 * 1024 * 1024;
    const emailBatches: EmailBatch[] = [];
    let currentBatch: EmailBatch = { attachments: [], totalSize: 0, documentNames: [] };

    for (const attachment of attachments) {
      if (currentBatch.totalSize + attachment.size > maxEmailSize && currentBatch.attachments.length > 0) {
        emailBatches.push(currentBatch);
        currentBatch = { attachments: [], totalSize: 0, documentNames: [] };
      }
      
      currentBatch.attachments.push(attachment);
      currentBatch.totalSize += attachment.size;
      currentBatch.documentNames.push(attachment.documentName);
    }
    
    if (currentBatch.attachments.length > 0) {
      emailBatches.push(currentBatch);
    }

    const safeCompanyName = escapeHtml(profile?.company_name);
    const safeControllerName = escapeHtml(profile?.controller_name);
    const safeShowmenName = escapeHtml(profile?.showmen_name);
    const safeAddress = escapeHtml(profile?.address);
    const safeUserEmail = escapeHtml(user.email);
    const safeRideName = escapeHtml(ride.ride_name);
    const safeManufacturer = escapeHtml(ride.manufacturer);
    const safeSerialNumber = escapeHtml(ride.serial_number);
    const safeMessage = escapeHtml(message);
    const senderName = safeCompanyName || safeControllerName || "Ride Operator";
    const rideInfo = `${safeRideName}${safeManufacturer ? ` (${safeManufacturer})` : ''}`;
    const currentYear = new Date().getFullYear();
    
    const emailResponses = [];
    let totalEmailsSent = 0;

    for (let i = 0; i < emailBatches.length; i++) {
      const batch = emailBatches[i];
      const batchNumber = i + 1;
      const totalBatches = emailBatches.length;
      
      const subject = totalBatches > 1 
        ? `Ride Documentation (${batchNumber}/${totalBatches}): ${rideInfo}`
        : `Ride Documentation: ${rideInfo}`;

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ride Documentation Package</title>
</head>
<body style="${emailStyles.body}">
  <div style="${emailStyles.container}">
    <div style="${emailStyles.header}">
      <div style="margin-bottom: 16px;">${logoSvg}</div>
      <h1 style="${emailStyles.headerTitle}">Ride Documentation</h1>
      <p style="${emailStyles.headerSubtitle}">${safeRideName}${totalBatches > 1 ? ` (${batchNumber}/${totalBatches})` : ''}</p>
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

      ${totalBatches > 1 ? `
        <div style="${emailStyles.warningBox}">
          <p style="margin: 0; font-weight: 600; color: ${brandColors.text};">📬 Email ${batchNumber} of ${totalBatches}</p>
          <p style="margin: 8px 0 0 0; color: ${brandColors.textLight}; font-size: 14px;">This documentation has been split into multiple emails due to size limitations.</p>
        </div>
      ` : ''}

      <div style="${emailStyles.card}">
        <p style="${emailStyles.label}">RIDE INFORMATION</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Ride Name:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};">${safeRideName}</td>
          </tr>
          ${safeManufacturer ? `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Manufacturer:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};">${safeManufacturer}</td>
          </tr>
          ` : ''}
          ${safeSerialNumber ? `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Serial Number:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};">${safeSerialNumber}</td>
          </tr>
          ` : ''}
          ${ride.year_manufactured ? `
          <tr>
            <td style="padding: 8px 0;"><strong>Year Manufactured:</strong></td>
            <td style="padding: 8px 0;">${ride.year_manufactured}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      ${safeMessage ? `
        <div style="margin: 24px 0;">
          <p style="${emailStyles.label}">MESSAGE</p>
          <p style="${emailStyles.value}; line-height: 1.8;">${safeMessage}</p>
        </div>
      ` : ''}

      <div style="margin: 24px 0;">
        <p style="${emailStyles.label}">ATTACHED DOCUMENTS${totalBatches > 1 ? ` (BATCH ${batchNumber})` : ''}</p>
        ${batch.attachments.map(att => `
          <div style="padding: 12px; margin: 8px 0; background: ${brandColors.background}; border-radius: 6px; border-left: 3px solid ${brandColors.primary};">
            <span style="font-weight: 500;">📄 ${escapeHtml(att.documentName)}</span>
            <span style="color: ${brandColors.textLight}; font-size: 13px;"> (${escapeHtml(att.documentType)})</span>
            ${att.expiresAt ? `<br><span style="color: ${brandColors.textLight}; font-size: 12px;">Expires: ${escapeHtml(att.expiresAt)}</span>` : ''}
          </div>
        `).join('')}
        <p style="color: ${brandColors.textLight}; font-size: 13px; margin-top: 16px;">
          ${batch.attachments.length} documents in this email
          ${totalBatches > 1 ? ` • ${attachments.length} total documents across ${totalBatches} emails` : ''}
        </p>
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

      const cleanAttachments = batch.attachments.map(({ size, documentName, documentType, expiresAt, ...attachment }) => attachment);

      const emailResponse = await resend.emails.send({
        from: "Ride Ready Docs <info@ridereadydocs.com>",
        to: [recipientEmail],
        subject,
        html: htmlContent,
        attachments: cleanAttachments.length > 0 ? cleanAttachments : undefined,
      });

      emailResponses.push(emailResponse);
      totalEmailsSent++;
      
      console.log(`Email batch ${batchNumber}/${totalBatches} sent successfully:`, emailResponse);
    }

    // Log the email send for audit trail
    const notificationMessage = totalEmailsSent > 1 
      ? `Sent ${attachments.length} documents for ${ride.ride_name} to ${recipientEmail} across ${totalEmailsSent} emails`
      : `Sent ${attachments.length} documents for ${ride.ride_name} to ${recipientEmail}`;

    await supabase
      .from("notifications")
      .insert({
        user_id: user.id,
        title: "Documents Sent",
        message: notificationMessage,
        type: "info",
        related_table: "rides",
        related_id: rideId
      });

    return new Response(JSON.stringify({ 
      success: true, 
      emailIds: emailResponses.map(r => r.data?.id).filter(Boolean),
      documentsCount: attachments.length,
      emailsSent: totalEmailsSent,
      wasSplit: totalEmailsSent > 1
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-ride-documents function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send documents. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
