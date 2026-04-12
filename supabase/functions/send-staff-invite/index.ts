import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { 
  checkRateLimit, 
  getClientIdentifier, 
  createRateLimitResponse,
  getSecureHeaders,
  checkIpBlocked,
  createBlockedIpResponse,
  getClientIp
} from "../_shared/rate-limit.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { logEmailSend } from "../_shared/email-logger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface FeaturePermissions {
  calendar: boolean;
  documents: boolean;
  checks: boolean;
  maintenance: boolean;
  risk_assessments: boolean;
  send_documents: boolean;
}

interface StaffInviteRequest {
  email: string;
  permissionLevel: "manager" | "supervisor" | "staff";
  assignedRides?: string[] | null;
  featurePermissions?: FeaturePermissions;
}

const msPerDay = 24 * 60 * 60 * 1000;

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const clientIp = getClientIp(req);
    const ipBlockResult = await checkIpBlocked(clientIp);
    if (ipBlockResult.isBlocked) {
      return createBlockedIpResponse(ipBlockResult, corsHeaders);
    }

    const rateLimitKey = getClientIdentifier(req, "send-staff-invite");
    const rateLimitResult = await checkRateLimit(rateLimitKey, "email");
    
    if (!rateLimitResult.allowed) {
      console.warn(`[STAFF-INVITE] Rate limit exceeded for ${rateLimitKey}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Check subscription status — block invites for expired accounts
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const subStatus = profile?.subscription_status;
    const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const isTrialExpired = subStatus === 'trial' && trialEndsAt && trialEndsAt <= new Date();
    const isExpired = subStatus === 'expired' || isTrialExpired;

    if (isExpired) {
      return new Response(
        JSON.stringify({ error: "Your subscription has expired. Please resubscribe before inviting new staff." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, permissionLevel, assignedRides, featurePermissions }: StaffInviteRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!permissionLevel || !["manager", "supervisor", "staff"].includes(permissionLevel)) {
      return new Response(
        JSON.stringify({ error: "Valid permission level is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase();

    const { data: existingInvite } = await supabase
      .from("staff_invites")
      .select("id, status, invite_token, expires_at")
      .eq("email", normalizedEmail)
      .eq("organisation_id", organisation.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite?.expires_at && new Date(existingInvite.expires_at) < new Date()) {
      await supabase
        .from("staff_invites")
        .update({ status: "expired" })
        .eq("id", existingInvite.id);
    }

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

    const defaultPermissions: FeaturePermissions = {
      calendar: false,
      checks: true,
      documents: false,
      maintenance: true,
      risk_assessments: false,
      send_documents: false,
    };

    const permissions = featurePermissions || defaultPermissions;

    let invite: { id: string; invite_token: string; expires_at: string } | null = null;
    let inviteIdForCleanup: string | null = null;

    if (existingInvite && (!existingInvite.expires_at || new Date(existingInvite.expires_at) >= new Date())) {
      await supabase
        .from("staff_invites")
        .update({ 
          permission_level: permissionLevel,
          can_access_calendar: permissions.calendar,
          can_access_documents: permissions.documents,
          can_access_checks: permissions.checks,
          can_access_maintenance: permissions.maintenance,
          can_access_risk_assessments: permissions.risk_assessments,
          can_access_send_documents: permissions.send_documents,
        })
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
          can_access_calendar: permissions.calendar,
          can_access_documents: permissions.documents,
          can_access_checks: permissions.checks,
          can_access_maintenance: permissions.maintenance,
          can_access_risk_assessments: permissions.risk_assessments,
          can_access_send_documents: permissions.send_documents,
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("controller_name, company_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const inviterName = profile?.controller_name || profile?.company_name || "Your employer";
    const companyName = profile?.company_name || organisation.name;

    const baseUrl = "https://ridereadydocs.com";
    const inviteUrl = `${baseUrl}/staff-invite/${invite.invite_token}`;

    const featureList: string[] = [];
    if (permissions.checks) featureList.push("Safety checks");
    if (permissions.maintenance) featureList.push("Maintenance logging");
    featureList.push("Wind & pressure readings");
    featureList.push("Defect reporting");

    const subject = `${inviterName} invited you to join ${companyName} on Ride Ready Docs`;

    const expiresDate = new Date(invite.expires_at);
    const expiresFormatted = expiresDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: [email],
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 560px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1F3A5F, #2F6FB2); color: white; padding: 24px 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
            .header p { margin: 0; font-size: 13px; opacity: 0.85; }
            .content { background: #f8f9fa; padding: 28px 30px; border-radius: 0 0 12px 12px; }
            .detail-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            .detail-table td { padding: 8px 0; vertical-align: top; font-size: 14px; }
            .detail-label { color: #666; width: 130px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
            .detail-value { color: #111; font-weight: 500; }
            .button { display: inline-block; background: #FCBA04; color: #000; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; font-size: 15px; }
            .feature-box { background: #e8f4f8; padding: 14px 16px; border-radius: 8px; margin: 16px 0; }
            .feature-box p { margin: 0 0 6px; font-weight: 600; font-size: 13px; }
            .feature-list { list-style: none; padding: 0; margin: 0; }
            .feature-list li { padding: 3px 0; font-size: 13px; }
            .feature-list li:before { content: "✓ "; color: #22c55e; font-weight: bold; }
            .footer { text-align: center; color: #888; font-size: 11px; margin-top: 20px; padding: 0 20px; }
            .help-text { font-size: 13px; color: #555; background: #fff8e1; padding: 12px 14px; border-radius: 8px; margin: 16px 0; border-left: 3px solid #FCBA04; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ride Ready Docs</h1>
              <p>Staff Invitation</p>
            </div>
            <div class="content">
              <p style="font-size: 16px; margin-top: 0;">Hi there 👋</p>
              <p><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> as a staff member on Ride Ready Docs.</p>
              
              <table class="detail-table">
                <tr>
                  <td class="detail-label">Invited by</td>
                  <td class="detail-value">${inviterName}</td>
                </tr>
                <tr>
                  <td class="detail-label">Organisation</td>
                  <td class="detail-value">${companyName}</td>
                </tr>
                <tr>
                  <td class="detail-label">Invited email</td>
                  <td class="detail-value">${email}</td>
                </tr>
                <tr>
                  <td class="detail-label">Role</td>
                  <td class="detail-value">Staff</td>
                </tr>
                <tr>
                  <td class="detail-label">Expires</td>
                  <td class="detail-value">${expiresFormatted}</td>
                </tr>
              </table>

              <div class="feature-box">
                <p>Your access will include:</p>
                <ul class="feature-list">
                  ${featureList.map(f => `<li>${f}</li>`).join('')}
                </ul>
              </div>

              <p style="text-align: center;">
                <a href="${inviteUrl}" class="button">Accept Invitation</a>
              </p>
              
              <div class="help-text">
                <strong>New to Ride Ready Docs?</strong> You'll create a password when you accept. If you already have an account with this email, just sign in on the invite page.
              </div>

              <p style="font-size: 12px; color: #999; margin-bottom: 0;">
                If you didn't expect this invite, you can safely ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>Sent by Ride Ready Docs &middot; <a href="https://ridereadydocs.com" style="color: #888;">ridereadydocs.com</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if ((emailResponse as any)?.error) {
      console.error("Staff invite email send error:", (emailResponse as any).error);
      await logEmailSend({ template_name: 'staff-invite', recipient_email: email, subject, status: 'failed', error_message: (emailResponse as any).error?.message, user_id: user.id });

      if (inviteIdForCleanup) {
        await supabase.from("staff_invites").delete().eq("id", inviteIdForCleanup);
      }

      return new Response(
        JSON.stringify({ error: (emailResponse as any).error?.message || "Failed to send invite email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Staff invite email sent:", emailResponse);
    await logEmailSend({ template_name: 'staff-invite', recipient_email: email, subject, status: 'sent', user_id: user.id, metadata: { organisation_id: organisation.id, permission_level: permissionLevel } });

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
