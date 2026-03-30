import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";
import { brandColors, buildMarketingEmail, buildCtaButton, escapeHtml } from "../_shared/email-template.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";
import { logEmailSend } from "../_shared/email-logger.ts";

function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

serve(async (req: Request) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  const clientIp = getClientIp(req);
  const blockResult = await checkIpBlocked(clientIp);
  if (blockResult.isBlocked) {
    return createBlockedIpResponse(blockResult, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const resend = new Resend(resendApiKey);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const rateLimitKey = getClientIdentifier(req, "send-test-marketing-email", user.id);
    const rateLimitResult = await checkRateLimit(rateLimitKey, "email");
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { testEmail, subject, content } = await req.json();

    if (!testEmail || !subject || !content) {
      return new Response(
        JSON.stringify({ error: "testEmail, subject, and content are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const senderName = "Ride Ready Docs";

    // Personalize with test placeholders
    const personalizeText = (text: string): string => {
      return text
        .replace(/\{\{first_name\}\}/g, "Test")
        .replace(/\{\{name\}\}/g, "Test Recipient")
        .replace(/\{\{company\}\}/g, "Test Company")
        .replace(/\{\{email\}\}/g, testEmail)
        .replace(/\{\{unsubscribe_url\}\}/g, "#unsubscribe-test")
        .replace(/\{\{website_url\}\}/g, "https://ridereadydocs.com")
        .replace(/\{\{support_email\}\}/g, "info@ridereadydocs.com");
    };

    const personalizedSubject = `[TEST] ${personalizeText(subject)}`;
    const personalizedContent = personalizeText(content);

    const bodyHtml = `
      <div style="line-height: 1.7; color: ${brandColors.text}; font-size: 15px;">
        ${textToHtml(personalizedContent)}
      </div>
    `;

    const htmlContent = buildMarketingEmail({
      subject: personalizedSubject,
      bodyHtml,
      footerCompany: senderName,
    });

    const fromAddress = `${senderName} <info@ridereadydocs.com>`;

    await resend.emails.send({
      from: fromAddress,
      to: [testEmail],
      reply_to: "info@ridereadydocs.com",
      subject: personalizedSubject,
      html: htmlContent,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sentTo: testEmail,
        sentAt: new Date().toISOString(),
        fromName: senderName,
        fromEmail: "info@ridereadydocs.com",
        replyTo: "info@ridereadydocs.com",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Test send error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send test email" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
