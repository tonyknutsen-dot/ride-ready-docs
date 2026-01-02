import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Escape HTML to prevent XSS
function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Convert plain text to HTML with proper line breaks
function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(user.id);
    const senderEmail = userData.user?.email || "noreply@example.com";

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

        // Build HTML email
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    ${textToHtml(personalizedContent)}
  </div>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
    <p style="font-size: 12px; color: #666;">
      ${profile?.company_name ? `Sent by ${escapeHtml(profile.company_name)}<br>` : ""}
      <a href="${unsubscribeUrl}" style="color: #666;">Unsubscribe from these emails</a>
    </p>
  </div>
</body>
</html>`;

        // Send email
        const emailResponse = await resend.emails.send({
          from: profile?.company_name 
            ? `${profile.company_name} <onboarding@resend.dev>` 
            : "Marketing <onboarding@resend.dev>",
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
