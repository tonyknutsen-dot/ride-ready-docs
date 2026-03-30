import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { brandColors, emailStyles, logoSvg, generateEmailWrapper, escapeHtml } from "../_shared/email-template.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";
import { logEmailSend } from "../_shared/email-logger.ts";

interface SendRiskAssessmentRequest {
  assessmentId: string;
  rideId: string;
  rideName: string;
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  pdfBase64: string;
  pdfFileName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Check if IP is blocked
    const clientIp = getClientIp(req);
    const blockResult = await checkIpBlocked(clientIp);
    if (blockResult.isBlocked) {
      console.log(`Blocked IP ${clientIp} attempted to access send-risk-assessment`);
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

    // Rate limiting - email sending gets moderate limits
    const rateLimitKey = getClientIdentifier(req, "send-risk-assessment", user.id);
    const rateLimitResult = await checkRateLimit(rateLimitKey, "email");
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for user ${user.id}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const {
      assessmentId,
      rideId,
      rideName,
      recipientEmail,
      recipientName = "Recipient",
      message = "",
      pdfBase64,
      pdfFileName
    }: SendRiskAssessmentRequest = await req.json();

    console.log(`Sending risk assessment ${assessmentId} to ${recipientEmail}`);

    // Get user profile for sender information
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name, controller_name, showmen_name, address")
      .eq("user_id", user.id)
      .single();

    // Get assessment details
    const { data: assessment } = await supabase
      .from("risk_assessments")
      .select("*")
      .eq("id", assessmentId)
      .eq("user_id", user.id)
      .single();

    if (!assessment) {
      throw new Error("Risk assessment not found");
    }

    const safeRideName = escapeHtml(rideName);
    const safeMessage = escapeHtml(message);
    const safeCompanyName = escapeHtml(profile?.company_name);
    const safeControllerName = escapeHtml(profile?.controller_name);
    const safeShowmenName = escapeHtml(profile?.showmen_name);
    const safeAddress = escapeHtml(profile?.address);
    const safeAssessorName = escapeHtml(assessment.assessor_name);
    const safePdfFileName = escapeHtml(pdfFileName);
    const safeUserEmail = escapeHtml(user.email);

    const content = `
      <p style="font-size: 16px; margin-bottom: 20px;">
        Please find attached the risk assessment document for <strong>${safeRideName}</strong>.
      </p>

      <div style="${emailStyles.infoBox}">
        <p style="${emailStyles.label}">FROM</p>
        ${safeCompanyName ? `<p style="${emailStyles.value}"><strong>Company:</strong> ${safeCompanyName}</p>` : ''}
        ${safeControllerName ? `<p style="${emailStyles.value}"><strong>Controller:</strong> ${safeControllerName}</p>` : ''}
        ${safeShowmenName ? `<p style="${emailStyles.value}; color: ${brandColors.textLight};"><strong>Showmen:</strong> ${safeShowmenName}</p>` : ''}
        ${safeAddress ? `<p style="${emailStyles.value}; color: ${brandColors.textLight};"><strong>Address:</strong> ${safeAddress}</p>` : ''}
        <p style="${emailStyles.value}; color: ${brandColors.textLight};"><strong>Email:</strong> ${safeUserEmail}</p>
      </div>

      <div style="${emailStyles.card}">
        <p style="${emailStyles.label}">ASSESSMENT DETAILS</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Ride/Equipment:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};">${safeRideName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Assessor:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};">${safeAssessorName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Assessment Date:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid ${brandColors.border};">${new Date(assessment.assessment_date).toLocaleDateString('en-GB')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Status:</strong></td>
            <td style="padding: 8px 0;">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: ${assessment.overall_status === 'completed' ? brandColors.success : brandColors.accent}; color: white;">
                ${assessment.overall_status === 'completed' ? '✓ Completed' : '◷ In Progress'}
              </span>
            </td>
          </tr>
        </table>
      </div>

      ${safeMessage ? `
        <div style="margin: 24px 0;">
          <p style="${emailStyles.label}">MESSAGE</p>
          <p style="${emailStyles.value}; line-height: 1.8;">${safeMessage}</p>
        </div>
      ` : ''}

      <div style="${emailStyles.successBox}">
        <p style="margin: 0; font-weight: 600; color: ${brandColors.success};">📎 Attached Document</p>
        <p style="margin: 8px 0 0 0; color: ${brandColors.text};">📄 ${safePdfFileName}</p>
      </div>

      <hr style="${emailStyles.divider}">

      <p style="color: ${brandColors.textLight}; font-size: 14px;">
        This risk assessment was sent via Ride Ready Docs. If you have any questions, please contact ${safeControllerName || 'the sender'} directly.
      </p>
    `;

    const htmlContent = generateEmailWrapper('Risk Assessment', safeRideName, content);

    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: [recipientEmail],
      subject: `Risk Assessment: ${safeRideName}`,
      html: htmlContent,
      attachments: [{
        filename: pdfFileName,
        content: pdfBase64,
        type: "application/pdf",
      }],
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the email send for audit trail
    await supabase
      .from("notifications")
      .insert({
        user_id: user.id,
        title: "Risk Assessment Sent",
        message: `Risk assessment for ${rideName} sent to ${recipientEmail}`,
        type: "info",
        related_table: "risk_assessments",
        related_id: assessmentId
      });

    // Also log to audit trail
    await supabase
      .from("risk_assessment_audit_log")
      .insert({
        risk_assessment_id: assessmentId,
        action: "emailed",
        changed_by: profile?.controller_name || user.email || "Unknown",
        notes: `Emailed to ${recipientEmail}`
      });

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-risk-assessment function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send risk assessment. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
