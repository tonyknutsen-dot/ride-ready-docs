import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface RegisterTesterRequest {
  email: string;
  password: string;
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const { email, password, token }: RegisterTesterRequest = await req.json();

    if (!email || !password || !token) {
      return new Response(
        JSON.stringify({ error: "Email, password, and token are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the invite token is valid and matches the email
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("tester_invites")
      .select("*")
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
      // Mark as expired
      await supabaseAdmin
        .from("tester_invites")
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
      // User already exists - just assign tester role if not already
      userId = existingUser.id;
      console.log("User already exists, will assign tester role:", userId);
    } else {
      // Create user with email already confirmed (no confirmation email sent!)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Pre-confirm the email - no confirmation email sent!
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

    // Check if user already has tester role
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "tester")
      .maybeSingle();

    if (!existingRole) {
      // Assign tester role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "tester" });

      if (roleError) {
        console.error("Failed to assign tester role:", roleError);
        return new Response(
          JSON.stringify({ error: "Failed to assign tester role" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      console.log("Assigned tester role to user:", userId);
    }

    // Mark invite as accepted
    await supabaseAdmin
      .from("tester_invites")
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
        message: existingUser ? "Tester role assigned to existing account" : "Account created successfully"
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in register-tester function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
