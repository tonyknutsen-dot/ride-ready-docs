import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";
import { brandColors, emailStyles, logoHtml, escapeHtml } from "../_shared/email-template.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";

// Convert plain text to HTML with proper line breaks
function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Check if IP is blocked
  const clientIp = getClientIp(req);
  const blockResult = await checkIpBlocked(clientIp);
  if (blockResult.isBlocked) {
    console.log(`Blocked IP ${clientIp} attempted to access send-marketing-campaign`);
    return createBlockedIpResponse(blockResult, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const resend = new Resend(resendApiKey);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Authenticate user
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

    // Rate limiting - batch email operations get stricter limits
    const rateLimitKey = getClientIdentifier(req, "send-marketing-campaign", user.id);
    const rateLimitResult = await checkRateLimit(rateLimitKey, "batch");
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for user ${user.id}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    // Get request body
    const { campaignId } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Campaign ID required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      console.error("Campaign fetch error:", campaignError);
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user profile for sender info
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name")
      .eq("user_id", user.id)
      .single();

    // Fetch recipients with contact details
    const { data: recipients, error: recipientsError } = await supabase
      .from("campaign_recipients")
      .select(`
        id,
        contact:marketing_contacts(
          id,
          email,
          name,
          company_name,
          unsubscribe_token
        )
      `)
      .eq("campaign_id", campaignId)
      .eq("status", "pending");

    if (recipientsError) {
      console.error("Recipients fetch error:", recipientsError);
      throw recipientsError;
    }

    console.log(`Sending campaign ${campaignId} to ${recipients?.length || 0} recipients`);

    let sentCount = 0;
    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "") || supabaseUrl;
    const currentYear = new Date().getFullYear();

    // Process recipients
    for (const recipient of recipients || []) {
      const contact = Array.isArray(recipient.contact) ? recipient.contact[0] : recipient.contact;
      if (!contact) continue;

      try {
        // Personalize content
        const personalizedSubject = campaign.subject
          .replace(/\{\{name\}\}/g, contact.name || "Valued Customer")
          .replace(/\{\{company\}\}/g, contact.company_name || "")
          .replace(/\{\{email\}\}/g, contact.email);

        const personalizedContent = campaign.html_content
          .replace(/\{\{name\}\}/g, contact.name || "Valued Customer")
          .replace(/\{\{company\}\}/g, contact.company_name || "")
          .replace(/\{\{email\}\}/g, contact.email);

        // Build unsubscribe URL
        const unsubscribeUrl = `${baseUrl}/functions/v1/handle-unsubscribe?token=${contact.unsubscribe_token}`;

        // Build branded HTML email
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
        ${profile?.company_name ? `Sent by ${escapeHtml(profile.company_name)}<br><br>` : ""}
        © ${currentYear} Ride Ready Docs. All rights reserved.<br>
        Professional compliance management for amusement equipment.<br><br>
        <a href="https://ridereadydocs.com" style="${emailStyles.footerLink}">ridereadydocs.com</a> · 
        <a href="${unsubscribeUrl}" style="${emailStyles.footerLink}">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;

        // Send email
        const emailResponse = await resend.emails.send({
          from: profile?.company_name 
            ? `${profile.company_name} <info@ridereadydocs.com>` 
            : "Ride Ready Docs <info@ridereadydocs.com>",
          to: [contact.email],
          subject: personalizedSubject,
          html: htmlContent,
        });

        console.log(`Email sent to ${contact.email}:`, emailResponse);

        // Update recipient status
        await supabase
          .from("campaign_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", recipient.id);

        sentCount++;
      } catch (emailError: any) {
        console.error(`Failed to send to ${contact.email}:`, emailError);

        // Update recipient with error
        await supabase
          .from("campaign_recipients")
          .update({ 
            status: "failed", 
            error_message: emailError.message?.substring(0, 255) || "Unknown error"
          })
          .eq("id", recipient.id);
      }
    }

    // Update campaign status
    await supabase
      .from("email_campaigns")
      .update({ 
        status: "sent",
        sent_count: sentCount,
        sent_at: new Date().toISOString()
      })
      .eq("id", campaignId);

    console.log(`Campaign ${campaignId} completed: ${sentCount} sent`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount,
        total: recipients?.length || 0
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Campaign send error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send campaign" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
