import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface TesterInviteRequest {
  email: string;
  inviterName?: string;
  expiryDays?: number; // Days until tester role expires (0 = no expiry)
}

const msPerDay = 24 * 60 * 60 * 1000;

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header to identify the admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user is an admin
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authorization token missing" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      const msg = authError?.message || "Invalid token";
      console.error("Auth error in send-tester-invite:", msg);
      return new Response(
        JSON.stringify({ error: msg.includes("session") ? "Session expired, please sign in again" : "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, inviterName, expiryDays }: TesterInviteRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase();

    // Determine expiry
    const effectiveExpiryDays = typeof expiryDays === "number" ? expiryDays : 7;
    const computedExpiresAt =
      effectiveExpiryDays === 0
        ? null
        : new Date(Date.now() + effectiveExpiryDays * msPerDay).toISOString();

    // Check for existing pending invite
    const { data: existingInvite } = await supabase
      .from("tester_invites")
      .select("id, status, invite_token, expires_at")
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .maybeSingle();

    // If a pending invite exists but is expired, mark it expired so we can create a new one.
    if (existingInvite?.expires_at && new Date(existingInvite.expires_at) < new Date()) {
      await supabase
        .from("tester_invites")
        .update({ status: "expired" })
        .eq("id", existingInvite.id);
    }

    // Check if user already has tester role
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const targetUser = existingUser?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );
    
    if (targetUser) {
      const { data: testerRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUser.id)
        .eq("role", "tester")
        .single();

      if (testerRole) {
        return new Response(
          JSON.stringify({ error: "This user is already a tester" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create invite record
    let inviteIdForCleanup: string | null = null;

    // Reuse existing pending invite if still valid; otherwise create a new one.
    let invite:
      | { id: string; invite_token: string; expires_at: string | null }
      | null = null;

    if (existingInvite && (!existingInvite.expires_at || new Date(existingInvite.expires_at) >= new Date())) {
      invite = {
        id: existingInvite.id,
        invite_token: existingInvite.invite_token,
        expires_at: existingInvite.expires_at ?? null,
      };
    } else {
      const { data: createdInvite, error: inviteError } = await supabase
        .from("tester_invites")
        .insert({
          email: normalizedEmail,
          invited_by: user.id,
          expires_at: computedExpiresAt,
        })
        .select("id, invite_token, expires_at")
        .single();

      if (inviteError || !createdInvite) {
        console.error("Error creating invite:", inviteError);
        return new Response(
          JSON.stringify({ error: "Failed to create invite" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      inviteIdForCleanup = createdInvite.id;
      invite = createdInvite;
    }

    // Build invite URL using published URL
    const baseUrl = "https://ridereadydocs.com";
    const inviteUrl = `${baseUrl}/tester-invite/${invite.invite_token}`;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: [email],
      subject: "You're invited to be a Tester! 🧪",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1F3A5F, #2F6FB2); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #FCBA04; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            .badge { display: inline-block; background: #FCBA04; color: #000; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🧪 You're Invited to Test!</h1>
              <span class="badge">TESTER INVITE</span>
            </div>
            <div class="content">
              <p>Hi there!</p>
               <p>${inviterName ? `<strong>${inviterName}</strong> has` : 'You have been'} invited you to join <strong>Ride Ready Docs</strong> as a tester.</p>
              <p>As a tester, you'll:</p>
              <ul>
                <li>Get early access to new features</li>
                <li>See a "Test Mode" banner showing the current app version</li>
                <li>Have special tools to reset your test data</li>
                <li>Help us improve the app for everyone</li>
              </ul>
              <p style="text-align: center;">
                <a href="${inviteUrl}" class="button">Accept Tester Invite</a>
              </p>
              <p style="font-size: 14px; color: #666;">
                This invite expires in 7 days. If you didn't expect this invite, you can safely ignore this email.
              </p>
            </div>
            <div class="footer">
               <p>Ride Ready Docs - Document Management for Fairground Professionals</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    // Resend returns { data, error }
    if ((emailResponse as any)?.error) {
      console.error("Tester invite email send error:", (emailResponse as any).error);

      // If we created a new invite and the email failed, clean it up so it doesn't block retries.
      if (inviteIdForCleanup) {
        await supabase.from("tester_invites").delete().eq("id", inviteIdForCleanup);
      }

      return new Response(
        JSON.stringify({
          error:
            (emailResponse as any).error?.message ||
            "Failed to send invite email",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Tester invite email sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: existingInvite ? "Invite re-sent successfully" : "Invite sent successfully",
        inviteId: invite.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-tester-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
