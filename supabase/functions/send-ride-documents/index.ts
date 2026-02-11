import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { brandColors, emailStyles, logoSvg, escapeHtml } from "../_shared/email-template.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";

interface SendDocumentsRequest {
  rideId: string;
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  includeInsurance: boolean;
  documentIds: string[];
}

const MAX_DIRECT_ATTACH_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ZIP_ATTACH_SIZE = 25 * 1024 * 1024; // 25MB

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const clientIp = getClientIp(req);
    const blockResult = await checkIpBlocked(clientIp);
    if (blockResult.isBlocked) {
      console.log(`Blocked IP ${clientIp} attempted to access send-ride-documents`);
      return createBlockedIpResponse(blockResult, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const rateLimitKey = getClientIdentifier(req, "send-ride-documents", user.id);
    const rateLimitResult = await checkRateLimit(rateLimitKey, "email");
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for user ${user.id}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
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
    if (rideError || !ride) throw new Error("Ride not found");

    // Get user profile
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
    if (rideDocsError) throw new Error("Failed to fetch ride documents");

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

    // Download all documents
    const attachments = [];
    for (const doc of allDocuments) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("ride-documents")
          .download(doc.file_path);
        if (!downloadError && fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const fileExtension = doc.file_path.split('.').pop();
          const fileName = `${ride.ride_name}_${doc.document_name}.${fileExtension}`;
          attachments.push({
            filename: fileName,
            arrayBuffer,
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

    const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);
    console.log(`Total attachment size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

    // Shared email template helpers
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

    const buildSenderBlock = () => `
      <div style="${emailStyles.infoBox}">
        <p style="${emailStyles.label}">FROM</p>
        ${safeCompanyName ? `<p style="${emailStyles.value}"><strong>Company:</strong> ${safeCompanyName}</p>` : ''}
        ${safeControllerName ? `<p style="${emailStyles.value}"><strong>Controller:</strong> ${safeControllerName}</p>` : ''}
        ${safeShowmenName ? `<p style="${emailStyles.value}; color: ${brandColors.textLight};"><strong>${operatorLabel}:</strong> ${safeShowmenName}</p>` : ''}
        ${safeAddress ? `<p style="${emailStyles.value}; color: ${brandColors.textLight};"><strong>Address:</strong> ${safeAddress}</p>` : ''}
        <p style="${emailStyles.value}; color: ${brandColors.textLight};"><strong>Email:</strong> ${safeUserEmail}</p>
      </div>`;

    const buildRideInfoBlock = () => `
      <div style="${emailStyles.card}">
        <p style="${emailStyles.label}">RIDE INFORMATION</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Ride Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};">${safeRideName}</td></tr>
          ${safeManufacturer ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Manufacturer:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};">${safeManufacturer}</td></tr>` : ''}
          ${safeSerialNumber ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Serial Number:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};">${safeSerialNumber}</td></tr>` : ''}
          ${ride.year_manufactured ? `<tr><td style="padding: 8px 0;"><strong>Year Manufactured:</strong></td><td style="padding: 8px 0;">${ride.year_manufactured}</td></tr>` : ''}
        </table>
      </div>`;

    const buildDocumentList = (docs: typeof attachments, label?: string) => `
      <div style="margin: 24px 0;">
        <p style="${emailStyles.label}">${label || 'DOCUMENTS'}</p>
        ${docs.map(att => `
          <div style="padding: 12px; margin: 8px 0; background: ${brandColors.background}; border-radius: 6px; border-left: 3px solid ${brandColors.primary};">
            <span style="font-weight: 500;">📄 ${escapeHtml(att.documentName)}</span>
            <span style="color: ${brandColors.textLight}; font-size: 13px;"> (${escapeHtml(att.documentType)})</span>
            ${att.expiresAt ? `<br><span style="color: ${brandColors.textLight}; font-size: 12px;">Expires: ${escapeHtml(att.expiresAt)}</span>` : ''}
          </div>
        `).join('')}
        <p style="color: ${brandColors.textLight}; font-size: 13px; margin-top: 16px;">${docs.length} document(s)</p>
      </div>`;

    const buildFooter = () => `
      <hr style="${emailStyles.divider}">
      <p style="color: ${brandColors.textLight}; font-size: 14px;">
        This documentation package was sent via Ride Ready Docs. If you have any questions, please contact ${safeControllerName || 'the sender'} directly.
      </p>`;

    const buildEmailWrapper = (subtitle: string, innerContent: string) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ride Documentation Package</title></head>
<body style="${emailStyles.body}">
  <div style="${emailStyles.container}">
    <div style="${emailStyles.header}">
      <div style="margin-bottom: 16px;">${logoSvg}</div>
      <h1 style="${emailStyles.headerTitle}">Ride Documentation</h1>
      <p style="${emailStyles.headerSubtitle}">${subtitle}</p>
    </div>
    <div style="${emailStyles.content}">
      ${buildSenderBlock()}
      ${buildRideInfoBlock()}
      ${safeMessage ? `<div style="margin: 24px 0;"><p style="${emailStyles.label}">MESSAGE</p><p style="${emailStyles.value}; line-height: 1.8;">${safeMessage}</p></div>` : ''}
      ${innerContent}
      ${buildFooter()}
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

    let sendMethod: 'direct' | 'zip' | 'share-link' = 'direct';
    let emailResponse: any;
    let shareData: any = null;

    if (totalSize <= MAX_DIRECT_ATTACH_SIZE) {
      // ---- STRATEGY 1: Direct attachments ----
      sendMethod = 'direct';
      console.log('Sending documents as direct attachments');

      const emailAttachments = attachments.map(({ arrayBuffer, size, documentName, documentType, expiresAt, ...rest }) => ({
        ...rest,
        content: btoa(String.fromCharCode(...new Uint8Array(arrayBuffer))),
      }));

      const htmlContent = buildEmailWrapper(safeRideName, 
        buildDocumentList(attachments, 'ATTACHED DOCUMENTS')
      );

      emailResponse = await resend.emails.send({
        from: "Ride Ready Docs <info@ridereadydocs.com>",
        to: [recipientEmail],
        subject: `Ride Documentation: ${rideInfo}`,
        html: htmlContent,
        attachments: emailAttachments,
      });

    } else {
      // ---- Try zipping ----
      console.log('Total size exceeds 10MB, creating ZIP...');
      const zip = new JSZip();
      for (const att of attachments) {
        zip.file(att.filename, att.arrayBuffer);
      }
      const zipBlob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const zipSize = zipBlob.byteLength;
      console.log(`ZIP size: ${(zipSize / 1024 / 1024).toFixed(2)}MB`);

      if (zipSize <= MAX_ZIP_ATTACH_SIZE) {
        // ---- STRATEGY 2: ZIP attachment ----
        sendMethod = 'zip';
        console.log('Sending documents as ZIP attachment');

        const zipBase64 = btoa(String.fromCharCode(...zipBlob));
        const zipFilename = `${ride.ride_name.replace(/[^a-z0-9]/gi, '_')}_documents.zip`;

        const innerContent = `
          <div style="${emailStyles.warningBox}">
            <p style="margin: 0; font-weight: 600; color: ${brandColors.text};">📦 Documents sent as ZIP</p>
            <p style="margin: 8px 0 0 0; color: ${brandColors.textLight}; font-size: 14px;">The documents are attached as a single ZIP file because the total size exceeds 10MB.</p>
          </div>
          ${buildDocumentList(attachments, 'DOCUMENTS IN ZIP')}`;

        const htmlContent = buildEmailWrapper(safeRideName, innerContent);

        emailResponse = await resend.emails.send({
          from: "Ride Ready Docs <info@ridereadydocs.com>",
          to: [recipientEmail],
          subject: `Ride Documentation: ${rideInfo}`,
          html: htmlContent,
          attachments: [{
            filename: zipFilename,
            content: zipBase64,
            type: 'application/zip',
          }],
        });

      } else {
        // ---- STRATEGY 3: Share link fallback ----
        sendMethod = 'share-link';
        console.log('ZIP too large, falling back to share link');

        const shareToken = crypto.randomUUID() + '-' + crypto.randomUUID().slice(0, 8);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

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
        if (shareError) throw new Error("Failed to create document share");

        const shareItems = allDocuments.map(doc => ({
          share_id: share.id,
          document_id: doc.id,
          file_path: doc.file_path,
          document_name: doc.document_name,
          document_type: doc.document_type,
          ride_name: ride.ride_name
        }));
        const { error: itemsError } = await supabase.from("document_share_items").insert(shareItems);
        if (itemsError) {
          await supabase.from("document_shares").delete().eq("id", share.id);
          throw new Error("Failed to create document share items");
        }

        const downloadPageUrl = `https://ride-ready-docs.lovable.app/shared/${shareToken}`;
        const expiryDateFormatted = expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

        shareData = { shareId: share.id, shareToken, downloadUrl: downloadPageUrl };

        const innerContent = `
          <div style="margin: 24px 0; text-align: center;">
            <a href="${downloadPageUrl}" style="display: inline-block; padding: 14px 32px; background: ${brandColors.primary}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              📥 Download ${attachments.length} Document${attachments.length !== 1 ? 's' : ''}
            </a>
          </div>
          <div style="${emailStyles.warningBox}">
            <p style="margin: 0; font-weight: 600; color: ${brandColors.text};">⏰ Link expires: ${expiryDateFormatted}</p>
            <p style="margin: 8px 0 0 0; color: ${brandColors.textLight}; font-size: 14px;">The documents are too large to attach. Please use the download link above (expires in 7 days).</p>
          </div>
          ${buildDocumentList(attachments, 'INCLUDED DOCUMENTS')}`;

        const htmlContent = buildEmailWrapper(`${safeRideName} - Secure Download Link`, innerContent);

        emailResponse = await resend.emails.send({
          from: "Ride Ready Docs <info@ridereadydocs.com>",
          to: [recipientEmail],
          subject: `Ride Documentation: ${rideInfo}`,
          html: htmlContent,
        });
      }
    }

    console.log(`Email sent via ${sendMethod}:`, emailResponse);

    // Audit notification
    const notificationMessage = sendMethod === 'share-link'
      ? `Sent download link for ${attachments.length} documents for ${ride.ride_name} to ${recipientEmail}`
      : `Sent ${attachments.length} documents for ${ride.ride_name} to ${recipientEmail}${sendMethod === 'zip' ? ' (as ZIP)' : ''}`;

    await supabase.from("notifications").insert({
      user_id: user.id,
      title: "Documents Sent",
      message: notificationMessage,
      type: "info",
      related_table: "rides",
      related_id: rideId
    });

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse?.data?.id,
      documentsCount: attachments.length,
      sendMethod,
      ...(shareData || {}),
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
