import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AcceptInviteRequest {
  token: string;
  userId?: string; // If user is already logged in
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, userId }: AcceptInviteRequest = await req.json();
    console.log("[ACCEPT-STAFF-INVITE] Request received", { token: token?.substring(0, 10) + "...", userId });

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the invite with organisation details
    const { data: invite, error: inviteError } = await supabase
      .from("staff_invites")
      .select("*, organisations(id, name, owner_id)")
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
      await supabase
        .from("staff_invites")
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
          organisationName: invite.organisations?.name || "the organisation",
          permissionLevel: invite.permission_level,
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

    // Check if user is already a member of this organisation
    const { data: existingMember } = await supabase
      .from("organisation_members")
      .select("id, is_active")
      .eq("user_id", userId)
      .eq("organisation_id", invite.organisation_id)
      .maybeSingle();

    if (existingMember?.is_active) {
      // Mark invite as accepted anyway
      await supabase
        .from("staff_invites")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          accepted_by: userId,
        })
        .eq("id", invite.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "You're already a member of this organisation!",
          alreadyMember: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingMember && !existingMember.is_active) {
      // Reactivate existing membership
      await supabase
        .from("organisation_members")
        .update({ 
          is_active: true, 
          permission_level: invite.permission_level,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMember.id);
    } else {
      // Add user as organisation member
      const { error: memberError } = await supabase
        .from("organisation_members")
        .insert({
          user_id: userId,
          organisation_id: invite.organisation_id,
          permission_level: invite.permission_level,
          invited_by: invite.invited_by,
        });

      if (memberError) {
        console.error("Error adding organisation member:", memberError);
        return new Response(
          JSON.stringify({ error: "Failed to join organisation" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Mark invite as accepted
    await supabase
      .from("staff_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: userId,
      })
      .eq("id", invite.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Welcome to ${invite.organisations?.name || 'the team'}!`,
        organisationName: invite.organisations?.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in accept-staff-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
