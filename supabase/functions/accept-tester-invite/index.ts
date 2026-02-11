import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface AcceptInviteRequest {
  token: string;
  userId?: string; // If user is already logged in
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, userId }: AcceptInviteRequest = await req.json();
    console.log("[ACCEPT-TESTER-INVITE] Request received", { token: token?.substring(0, 10) + "...", userId });

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the invite
    const { data: invite, error: inviteError } = await supabase
      .from("tester_invites")
      .select("*")
      .eq("invite_token", token)
      .single();

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired invite", valid: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if invite is still valid
    if (invite.status !== "pending") {
      return new Response(
        JSON.stringify({ 
          error: `This invite has already been ${invite.status}`,
          valid: false,
          status: invite.status
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(invite.expires_at) < new Date()) {
      // Update status to expired
      await supabase
        .from("tester_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);

      return new Response(
        JSON.stringify({ error: "This invite has expired", valid: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If just validating (no userId), return invite info
    if (!userId) {
      return new Response(
        JSON.stringify({
          valid: true,
          email: invite.email,
          expiresAt: invite.expires_at,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User is accepting the invite - verify their email matches
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return new Response(
        JSON.stringify({ 
          error: "This invite was sent to a different email address",
          invitedEmail: invite.email,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has tester role
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "tester")
      .single();

    if (existingRole) {
      // Mark invite as accepted anyway
      await supabase
        .from("tester_invites")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          accepted_by: userId,
        })
        .eq("id", invite.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "You're already a tester!",
          alreadyTester: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Assign tester role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "tester" });

    if (roleError) {
      console.error("Error assigning tester role:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to assign tester role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark invite as accepted
    await supabase
      .from("tester_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: userId,
      })
      .eq("id", invite.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Welcome to the tester team!",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in accept-tester-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
