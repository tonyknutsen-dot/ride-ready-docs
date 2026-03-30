import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";
import { brandColors, emailStyles, buildMarketingEmail, buildCtaButton, escapeHtml } from "../_shared/email-template.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";
import { logEmailSend } from "../_shared/email-logger.ts";

// Convert plain text to HTML with proper line breaks
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

    const rateLimitKey = getClientIdentifier(req, "send-marketing-campaign", user.id);
    const rateLimitResult = await checkRateLimit(rateLimitKey, "batch");
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { campaignId } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Campaign ID required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name")
      .eq("user_id", user.id)
      .single();

    const { data: recipients, error: recipientsError } = await supabase
      .from("campaign_recipients")
      .select(`
        id,
        contact:marketing_contacts(
          id, email, name, company_name, unsubscribe_token
        )
      `)
      .eq("campaign_id", campaignId)
      .eq("status", "pending");

    if (recipientsError) throw recipientsError;

    let sentCount = 0;
    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "") || supabaseUrl;

    for (const recipient of recipients || []) {
      const contact = Array.isArray(recipient.contact) ? recipient.contact[0] : recipient.contact;
      if (!contact) continue;

      try {
        const firstName = contact.name ? contact.name.split(" ")[0] : "";
        const unsubscribeUrl = `${baseUrl}/functions/v1/handle-unsubscribe?token=${contact.unsubscribe_token}`;

        const personalizeText = (text: string): string => {
          return text
            .replace(/\{\{first_name\}\}/g, firstName || contact.name || "there")
            .replace(/\{\{name\}\}/g, contact.name || "Valued Customer")
            .replace(/\{\{company\}\}/g, contact.company_name || "")
            .replace(/\{\{email\}\}/g, contact.email)
            .replace(/\{\{website_url\}\}/g, "https://ridereadydocs.com")
            .replace(/\{\{support_email\}\}/g, "info@ridereadydocs.com")
            .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);
        };

        const personalizedSubject = personalizeText(campaign.subject);
        const personalizedContent = personalizeText(campaign.html_content);

        const bodyHtml = `
          <div style="line-height: 1.7; color: ${brandColors.text}; font-size: 15px;">
            ${textToHtml(personalizedContent)}
          </div>
        `;

        const htmlContent = buildMarketingEmail({
          subject: personalizedSubject,
          bodyHtml,
          footerCompany: profile?.company_name || undefined,
          unsubscribeUrl,
        });

        await resend.emails.send({
          from: "Ride Ready Docs <info@ridereadydocs.com>",
          reply_to: "info@ridereadydocs.com",
          to: [contact.email],
          subject: personalizedSubject,
          html: htmlContent,
        });

        await logEmailSend({
          template_name: 'marketing-campaign',
          recipient_email: contact.email,
          subject: personalizedSubject,
          status: 'sent',
          metadata: { campaign_id: campaignId },
        });

        await supabase
          .from("campaign_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", recipient.id);

        sentCount++;
      } catch (emailError: any) {
        console.error(`Failed to send to ${contact.email}:`, emailError);
        await supabase
          .from("campaign_recipients")
          .update({ 
            status: "failed", 
            error_message: emailError.message?.substring(0, 255) || "Unknown error"
          })
          .eq("id", recipient.id);
      }
    }

    await supabase
      .from("email_campaigns")
      .update({ 
        status: "sent",
        sent_count: sentCount,
        sent_at: new Date().toISOString()
      })
      .eq("id", campaignId);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: recipients?.length || 0 }),
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
