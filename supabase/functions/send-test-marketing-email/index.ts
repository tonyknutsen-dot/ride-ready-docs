import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";
import { brandColors, emailStyles, logoHtml, escapeHtml } from "../_shared/email-template.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";

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

    // Stricter rate limit for test sends
    const rateLimitKey = getClientIdentifier(req, "send-test-marketing-email", user.id);
    const rateLimitResult = await checkRateLimit(rateLimitKey, "standard");
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

    // Get user profile for sender info
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name")
      .eq("user_id", user.id)
      .single();

    const currentYear = new Date().getFullYear();
    const senderName = profile?.company_name || "Ride Ready Docs";

    // Personalize with test placeholders
    const personalizedSubject = `[TEST] ${subject}`
      .replace(/\{\{name\}\}/g, "Test Recipient")
      .replace(/\{\{company\}\}/g, "Test Company")
      .replace(/\{\{email\}\}/g, testEmail);

    const personalizedContent = content
      .replace(/\{\{name\}\}/g, "Test Recipient")
      .replace(/\{\{company\}\}/g, "Test Company")
      .replace(/\{\{email\}\}/g, testEmail);

    // Build the exact same branded HTML as the real campaign sender
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(personalizedSubject)}</title>
</head>
<body style="${emailStyles.body}">
  <div style="${emailStyles.container}">
    <!-- Header -->
    <div style="${emailStyles.header}">
      ${logoHtml}
    </div>
    
    <!-- Content -->
    <div style="${emailStyles.content}">
      <div style="line-height: 1.8; color: ${brandColors.text};">
        ${textToHtml(personalizedContent)}
      </div>
    </div>
    
    <!-- Footer -->
    <div style="${emailStyles.footer}">
      <p style="${emailStyles.footerText}">
        Sent by ${escapeHtml(senderName)}<br><br>
        © ${currentYear} Ride Ready Docs. All rights reserved.<br>
        Professional compliance management for amusement equipment.<br><br>
        <a href="https://ridereadydocs.com" style="${emailStyles.footerLink}">ridereadydocs.com</a> · 
        <span style="color: ${brandColors.textLight};">Unsubscribe</span>
      </p>
    </div>
  </div>
</body>
</html>`;

    const fromAddress = `${senderName} <info@ridereadydocs.com>`;

    const emailResponse = await resend.emails.send({
      from: fromAddress,
      to: [testEmail],
      reply_to: "info@ridereadydocs.com",
      subject: personalizedSubject,
      html: htmlContent,
    });

    console.log(`Test email sent to ${testEmail}:`, emailResponse);

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
