import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";

interface SharedDocument {
  id: string;
  document_name: string;
  document_type: string;
  ride_name: string;
  download_url: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Check if IP is blocked
    const clientIp = getClientIp(req);
    const blockResult = await checkIpBlocked(clientIp);
    if (blockResult.isBlocked) {
      console.log(`Blocked IP ${clientIp} attempted to access get-shared-documents`);
      return createBlockedIpResponse(blockResult, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting - public endpoint so stricter limits
    const rateLimitKey = getClientIdentifier(req, "get-shared-documents");
    const rateLimitResult = await checkRateLimit(rateLimitKey, "public");
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for ${clientIp}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { shareToken } = await req.json();

    if (!shareToken) {
      return new Response(
        JSON.stringify({ error: "Share token is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Looking up share token: ${shareToken.substring(0, 8)}...`);

    // Get the share record
    const { data: share, error: shareError } = await supabase
      .from("document_shares")
      .select("*")
      .eq("share_token", shareToken)
      .single();

    if (shareError || !share) {
      console.log("Share not found:", shareError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired share link" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if revoked
    if (share.is_revoked) {
      return new Response(
        JSON.stringify({ error: "This share link has been revoked" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    if (new Date(share.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This share link has expired" }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the share items
    const { data: shareItems, error: itemsError } = await supabase
      .from("document_share_items")
      .select("*")
      .eq("share_id", share.id);

    if (itemsError) {
      console.error("Error fetching share items:", itemsError);
      throw new Error("Failed to fetch documents");
    }

    // Get sender info for display
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name, controller_name")
      .eq("user_id", share.user_id)
      .single();

    // Generate signed URLs for each document (valid for 1 hour)
    const documents: SharedDocument[] = [];
    for (const item of shareItems || []) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("ride-documents")
        .createSignedUrl(item.file_path, 3600); // 1 hour expiry

      if (signedUrlError) {
        console.error(`Error generating signed URL for ${item.document_name}:`, signedUrlError);
        continue;
      }

      documents.push({
        id: item.id,
        document_name: item.document_name,
        document_type: item.document_type,
        ride_name: item.ride_name || 'Global',
        download_url: signedUrlData.signedUrl
      });
    }

    // Update access tracking
    const isFirstAccess = !share.accessed_at;
    await supabase
      .from("document_shares")
      .update({
        accessed_at: isFirstAccess ? new Date().toISOString() : share.accessed_at,
        access_count: share.access_count + 1
      })
      .eq("id", share.id);

    console.log(`Share accessed: ${documents.length} documents, access count: ${share.access_count + 1}`);

    return new Response(JSON.stringify({
      success: true,
      share: {
        recipientName: share.recipient_name,
        message: share.message,
        expiresAt: share.expires_at,
        accessCount: share.access_count + 1,
        sender: {
          companyName: profile?.company_name,
          controllerName: profile?.controller_name
        }
      },
      documents
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in get-shared-documents function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to retrieve documents. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
