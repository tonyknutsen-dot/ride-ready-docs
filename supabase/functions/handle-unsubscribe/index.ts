import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";

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
    console.log(`Blocked IP ${clientIp} attempted to access handle-unsubscribe`);
    return createBlockedIpResponse(blockResult, corsHeaders);
  }

  // Rate limiting for public endpoint
  const rateLimitKey = getClientIdentifier(req, "handle-unsubscribe");
  const rateLimitResult = await checkRateLimit(rateLimitKey, "public");
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get token from query params
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        generateHtmlPage("Error", "Invalid unsubscribe link. Please contact support.", false),
        { 
          status: 400, 
          headers: { "Content-Type": "text/html", ...corsHeaders } 
        }
      );
    }

    // Find contact by unsubscribe token
    const { data: contact, error: findError } = await supabase
      .from("marketing_contacts")
      .select("id, email, is_subscribed")
      .eq("unsubscribe_token", token)
      .single();

    if (findError || !contact) {
      console.error("Contact lookup error:", findError);
      return new Response(
        generateHtmlPage("Error", "Invalid or expired unsubscribe link.", false),
        { 
          status: 404, 
          headers: { "Content-Type": "text/html", ...corsHeaders } 
        }
      );
    }

    // Check if already unsubscribed
    if (!contact.is_subscribed) {
      return new Response(
        generateHtmlPage("Already Unsubscribed", "You have already been unsubscribed from our mailing list.", true),
        { 
          status: 200, 
          headers: { "Content-Type": "text/html", ...corsHeaders } 
        }
      );
    }

    // Update contact to unsubscribed
    const { error: updateError } = await supabase
      .from("marketing_contacts")
      .update({ 
        is_subscribed: false,
        unsubscribed_at: new Date().toISOString()
      })
      .eq("id", contact.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        generateHtmlPage("Error", "Failed to process your request. Please try again later.", false),
        { 
          status: 500, 
          headers: { "Content-Type": "text/html", ...corsHeaders } 
        }
      );
    }

    console.log(`Contact ${contact.email} unsubscribed successfully`);

    return new Response(
      generateHtmlPage("Unsubscribed", "You have been successfully unsubscribed from our mailing list. You will no longer receive marketing emails from us.", true),
      { 
        status: 200, 
        headers: { "Content-Type": "text/html", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Unsubscribe error:", error);
    return new Response(
      generateHtmlPage("Error", "An unexpected error occurred. Please try again later.", false),
      { 
        status: 500, 
        headers: { "Content-Type": "text/html", ...corsHeaders } 
      }
    );
  }
});

function generateHtmlPage(title: string, message: string, success: boolean): string {
  const iconColor = success ? "#22c55e" : "#ef4444";
  const icon = success 
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f3f4f6;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      padding: 40px;
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .icon {
      margin-bottom: 24px;
    }
    h1 {
      color: #111827;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    p {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
