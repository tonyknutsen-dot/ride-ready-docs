import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface StaffInviteRequest {
  email: string;
  permissionLevel: "checks_only" | "checks_maintenance" | "full_access";
  rideIds?: string[]; // Optional: if empty, staff can access all rides
}

const msPerDay = 24 * 60 * 60 * 1000;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header to identify the owner
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error in send-staff-invite:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user owns an organisation
    const { data: organisation, error: orgError } = await supabase
      .from("organisations")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (orgError || !organisation) {
      console.error("Organisation not found:", orgError);
      return new Response(
        JSON.stringify({ error: "You must create equipment first before inviting staff" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, permissionLevel, rideIds }: StaffInviteRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!permissionLevel || !["checks_only", "checks_maintenance", "full_access"].includes(permissionLevel)) {
      return new Response(
        JSON.stringify({ error: "Valid permission level is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase();

    // Check for existing pending invite
    const { data: existingInvite } = await supabase
      .from("staff_invites")
      .select("id, status, invite_token, expires_at")
      .eq("email", normalizedEmail)
      .eq("organisation_id", organisation.id)
      .eq("status", "pending")
      .maybeSingle();

    // If a pending invite exists but is expired, mark it expired
    if (existingInvite?.expires_at && new Date(existingInvite.expires_at) < new Date()) {
      await supabase
        .from("staff_invites")
        .update({ status: "expired" })
        .eq("id", existingInvite.id);
    }

    // Check if user is already a member of this organisation
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const targetUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );
    
    if (targetUser) {
      const { data: existingMember } = await supabase
        .from("organisation_members")
        .select("id")
        .eq("user_id", targetUser.id)
        .eq("organisation_id", organisation.id)
        .eq("is_active", true)
        .maybeSingle();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: "This person is already a staff member" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Store ride assignments in invite metadata (we'll apply them when accepted)
    const rideIdsJson = rideIds && rideIds.length > 0 ? JSON.stringify(rideIds) : null;

    // Create or reuse invite
    let invite: { id: string; invite_token: string; expires_at: string } | null = null;
    let inviteIdForCleanup: string | null = null;

    if (existingInvite && (!existingInvite.expires_at || new Date(existingInvite.expires_at) >= new Date())) {
      // Reuse existing valid invite, but update permission level
      await supabase
        .from("staff_invites")
        .update({ permission_level: permissionLevel })
        .eq("id", existingInvite.id);
      
      invite = {
        id: existingInvite.id,
        invite_token: existingInvite.invite_token,
        expires_at: existingInvite.expires_at ?? new Date(Date.now() + 7 * msPerDay).toISOString(),
      };
    } else {
      const expiresAt = new Date(Date.now() + 7 * msPerDay).toISOString();
      
      const { data: createdInvite, error: inviteError } = await supabase
        .from("staff_invites")
        .insert({
          email: normalizedEmail,
          organisation_id: organisation.id,
          permission_level: permissionLevel,
          invited_by: user.id,
          expires_at: expiresAt,
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

    // Store ride assignments temporarily (we'll use a separate table or metadata)
    if (rideIds && rideIds.length > 0) {
      // Store in a temp table or we'll pass via URL params - for now, store in invite
      // We can enhance this later if needed
    }

    // Get owner's profile for personalisation
    const { data: profile } = await supabase
      .from("profiles")
      .select("controller_name, company_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const inviterName = profile?.controller_name || profile?.company_name || "Your employer";
    const companyName = profile?.company_name || organisation.name;

    // Build invite URL
    const baseUrl = "https://ride-ready-docs.lovable.app";
    const inviteUrl = `${baseUrl}/staff-invite/${invite.invite_token}`;

    // Permission descriptions
    const permissionDescriptions = {
      checks_only: "Perform safety checks on assigned equipment",
      checks_maintenance: "Perform safety checks and log maintenance activities",
      full_access: "Full access to checks, maintenance, documents, and risk assessments",
    };

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: [email],
      subject: `You're invited to join ${companyName} on Ride Ready Docs`,
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
            .permission-box { background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>👋 You're Invited!</h1>
              <span class="badge">STAFF INVITE</span>
            </div>
            <div class="content">
              <p>Hi there!</p>
              <p><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on Ride Ready Docs.</p>
              
              <div class="permission-box">
                <p style="margin: 0; font-weight: bold;">Your access level:</p>
                <p style="margin: 5px 0 0 0;">${permissionDescriptions[permissionLevel]}</p>
              </div>

              <p>As a staff member, you'll be able to:</p>
              <ul>
                <li>Access equipment assigned to you</li>
                <li>Complete safety checks${permissionLevel !== 'checks_only' ? ' and log maintenance' : ''}</li>
                ${permissionLevel === 'full_access' ? '<li>View documents and risk assessments</li>' : ''}
                <li>Collaborate with your team</li>
              </ul>

              <p style="text-align: center;">
                <a href="${inviteUrl}" class="button">Accept Invitation</a>
              </p>
              
              <p style="font-size: 14px; color: #666;">
                This invite expires in 7 days. If you didn't expect this invite, you can safely ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>Ride Ready Docs - Safety Documentation for Fairground Professionals</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if ((emailResponse as any)?.error) {
      console.error("Staff invite email send error:", (emailResponse as any).error);

      if (inviteIdForCleanup) {
        await supabase.from("staff_invites").delete().eq("id", inviteIdForCleanup);
      }

      return new Response(
        JSON.stringify({
          error: (emailResponse as any).error?.message || "Failed to send invite email",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Staff invite email sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: existingInvite ? "Invite re-sent successfully" : "Invite sent successfully",
        inviteId: invite.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-staff-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
