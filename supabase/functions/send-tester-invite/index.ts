import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TesterInviteRequest {
  email: string;
  inviterName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
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

    const { email, inviterName }: TesterInviteRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing pending invite
    const { data: existingInvite } = await supabase
      .from("tester_invites")
      .select("id, status")
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "An invite is already pending for this email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has tester role
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const targetUser = existingUser?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
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
    const { data: invite, error: inviteError } = await supabase
      .from("tester_invites")
      .insert({
        email: email.toLowerCase(),
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invite:", inviteError);
      return new Response(
        JSON.stringify({ error: "Failed to create invite" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build invite URL using published URL
    const baseUrl = "https://ride-ready-docs.lovable.app";
    const inviteUrl = `${baseUrl}/tester-invite/${invite.invite_token}`;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Showmen's Ride Ready <onboarding@resend.dev>",
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
              <p>${inviterName ? `<strong>${inviterName}</strong> has` : 'You have been'} invited you to join <strong>Showmen's Ride Ready</strong> as a tester.</p>
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
              <p>Showmen's Ride Ready - Document Management for Fairground Professionals</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Tester invite email sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invite sent successfully",
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
