import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Support both GET (from email link) and POST requests
    let token: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = body.token;
    }

    if (!token) {
      console.log("[QUICK-UNBLOCK] Missing token");
      return new Response(
        generateHtmlResponse(false, "Missing unblock token. Please use the link from your email."),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    console.log("[QUICK-UNBLOCK] Attempting to unblock with token:", token.substring(0, 8) + "...");

    // Find the blocked IP by token
    const { data: blockedIp, error: fetchError } = await supabase
      .from("blocked_ips")
      .select("*")
      .eq("unblock_token", token)
      .eq("is_active", true)
      .single();

    if (fetchError || !blockedIp) {
      console.log("[QUICK-UNBLOCK] Token not found or already used:", fetchError?.message);
      return new Response(
        generateHtmlResponse(false, "Invalid or expired unblock token. The IP may have already been unblocked."),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    // Check if the block has already expired
    if (new Date(blockedIp.expires_at) < new Date()) {
      console.log("[QUICK-UNBLOCK] Block already expired for IP:", blockedIp.ip_address);
      
      // Mark as inactive since it expired
      await supabase
        .from("blocked_ips")
        .update({ is_active: false })
        .eq("id", blockedIp.id);

      return new Response(
        generateHtmlResponse(true, `The block for IP ${blockedIp.ip_address} had already expired.`),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    // Unblock the IP
    const { error: updateError } = await supabase
      .from("blocked_ips")
      .update({
        is_active: false,
        unblocked_at: new Date().toISOString(),
        unblocked_by: "quick-unblock-link",
      })
      .eq("id", blockedIp.id);

    if (updateError) {
      console.error("[QUICK-UNBLOCK] Failed to unblock:", updateError);
      return new Response(
        generateHtmlResponse(false, "Failed to unblock IP. Please try again or use the admin dashboard."),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    console.log(`[QUICK-UNBLOCK] Successfully unblocked IP: ${blockedIp.ip_address}`);

    return new Response(
      generateHtmlResponse(true, `IP ${blockedIp.ip_address} has been successfully unblocked.`, blockedIp),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );

  } catch (error: any) {
    console.error("[QUICK-UNBLOCK] Unexpected error:", error);
    return new Response(
      generateHtmlResponse(false, "An unexpected error occurred. Please try again."),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );
  }
});

function generateHtmlResponse(success: boolean, message: string, blockedIp?: any): string {
  const statusColor = success ? "#22c55e" : "#ef4444";
  const statusIcon = success ? "✅" : "❌";
  const statusTitle = success ? "Success" : "Error";

  const detailsSection = blockedIp ? `
    <div style="margin-top: 24px; padding: 16px; background-color: #f9fafb; border-radius: 8px; text-align: left;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; text-transform: uppercase;">Block Details</h3>
      <p style="margin: 4px 0; font-size: 14px;"><strong>IP Address:</strong> ${blockedIp.ip_address}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Blocked At:</strong> ${new Date(blockedIp.blocked_at).toLocaleString()}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Reason:</strong> ${blockedIp.reason}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Request Count:</strong> ${blockedIp.request_count || 'N/A'}</p>
    </div>
  ` : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>IP Unblock - Ride Ready</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
      <div style="width: 100%; max-width: 480px; margin: 40px 20px; padding: 40px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); text-align: center;">
        
        <div style="width: 80px; height: 80px; margin: 0 auto 24px; background-color: ${statusColor}15; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px;">
          ${statusIcon}
        </div>
        
        <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: ${statusColor};">
          ${statusTitle}
        </h1>
        
        <p style="margin: 0 0 24px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
          ${message}
        </p>
        
        ${detailsSection}
        
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <a href="https://ride-ready-docs.lovable.app/admin/security" 
             style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
            Go to Security Dashboard
          </a>
        </div>
        
        <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
          Ride Ready Security System
        </p>
      </div>
    </body>
    </html>
  `;
}
