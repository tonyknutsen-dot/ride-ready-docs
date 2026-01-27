import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegisterStaffRequest {
  email: string;
  password: string;
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, token }: RegisterStaffRequest = await req.json();

    if (!email || !password || !token) {
      return new Response(
        JSON.stringify({ error: "Email, password, and token are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the invite token is valid and matches the email
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("staff_invites")
      .select("*, organisations(id, name, owner_id)")
      .eq("invite_token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (inviteError || !invite) {
      console.error("Invalid invite token:", inviteError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired invite token" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if invite has expired
    if (new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin
        .from("staff_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);

      return new Response(
        JSON.stringify({ error: "This invite has expired" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify email matches the invite
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Email does not match the invite" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log("User already exists, will add to organisation:", userId);
    } else {
      // Create user with email already confirmed
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
      });

      if (createError || !newUser.user) {
        console.error("Failed to create user:", createError);
        return new Response(
          JSON.stringify({ error: createError?.message || "Failed to create account" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      userId = newUser.user.id;
      console.log("Created new user with confirmed email:", userId);
    }

    // Check if user is already a member of this organisation
    const { data: existingMember } = await supabaseAdmin
      .from("organisation_members")
      .select("id")
      .eq("user_id", userId)
      .eq("organisation_id", invite.organisation_id)
      .maybeSingle();

    if (!existingMember) {
      // Add user as organisation member
      const { error: memberError } = await supabaseAdmin
        .from("organisation_members")
        .insert({
          user_id: userId,
          organisation_id: invite.organisation_id,
          permission_level: invite.permission_level,
          invited_by: invite.invited_by,
        });

      if (memberError) {
        console.error("Failed to add organisation member:", memberError);
        return new Response(
          JSON.stringify({ error: "Failed to join organisation" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      console.log("Added user to organisation:", invite.organisation_id);
    } else {
      // Update existing membership to active
      await supabaseAdmin
        .from("organisation_members")
        .update({ is_active: true, permission_level: invite.permission_level })
        .eq("id", existingMember.id);
    }

    // Mark invite as accepted
    await supabaseAdmin
      .from("staff_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: userId,
      })
      .eq("id", invite.id);

    console.log("Invite marked as accepted");

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        organisationName: invite.organisations?.name || "the organisation",
        message: existingUser ? "Added to organisation" : "Account created successfully"
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in register-staff function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
