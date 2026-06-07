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
import { auditedResendSend } from "../_shared/resend-audit.ts";

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

    // Check for existing pending invite for this org
    const { data: existingInvite } = await supabase
      .from("staff_invites")
      .select("id, status, invite_token, expires_at, created_at, updated_at")
      .eq("email", normalizedEmail)
      .eq("organisation_id", organisation.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite?.expires_at && new Date(existingInvite.expires_at) < new Date()) {
      await supabase
        .from("staff_invites")
        .update({ status: "expired" })
        .eq("id", existingInvite.id);
    } else if (existingInvite) {
      // Still valid pending invite — block duplicate, return structured details
      const sentAt = existingInvite.updated_at || existingInvite.created_at;
      const fmt = (iso: string | null) => iso
        ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
      return new Response(
        JSON.stringify({
          error: `Invite already pending. An invite was already sent to ${email} on ${fmt(sentAt)} and expires on ${fmt(existingInvite.expires_at)}. Use Resend, Copy Link, or Cancel from the pending invite card.`,
          code: "duplicate_pending",
          details: {
            email,
            sentAt,
            expiresAt: existingInvite.expires_at,
          },
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists in auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const targetUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );
    
    if (targetUser) {
      // Check if already an active member of this org
      const { data: existingMember } = await supabase
        .from("organisation_members")
        .select("id")
        .eq("user_id", targetUser.id)
        .eq("organisation_id", organisation.id)
        .eq("is_active", true)
        .maybeSingle();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: "This email is already a member of your organisation." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user belongs to another organisation
      const { data: otherOrgMember } = await supabase
        .from("organisation_members")
        .select("id, organisations(name)")
        .eq("user_id", targetUser.id)
        .eq("is_active", true)
        .neq("organisation_id", organisation.id)
        .maybeSingle();

      if (otherOrgMember) {
        return new Response(
          JSON.stringify({ error: "This email already has a Ride Ready Docs account with another organisation. They must be removed from that organisation first." }),
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
      // Resend / repeat-send: refresh expiry, reset reminder flag, bump updated_at.
      const refreshedExpiresAt = new Date(Date.now() + 7 * msPerDay).toISOString();
      await supabase
        .from("staff_invites")
        .update({ 
          permission_level: permissionLevel,
          expires_at: refreshedExpiresAt,
          expiry_reminder_sent: false,
          updated_at: new Date().toISOString(),
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
        expires_at: refreshedExpiresAt,
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

    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("controller_name, company_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const inviterName = inviterProfile?.controller_name || inviterProfile?.company_name || "Your employer";
    const companyName = inviterProfile?.company_name || organisation.name;

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

    // ---- Email HTML — fully inline, mobile-safe, Gmail-safe ----
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    const safeInviter = esc(inviterName);
    const safeCompany = esc(companyName);
    const safeEmail = esc(email);
    const safeExpires = esc(expiresFormatted);

    const PRIMARY = '#1F3A5F';
    const ACCENT = '#FCBA04';
    const TEXT = '#1f2937';
    const MUTED = '#6b7280';
    const BORDER = '#e5e7eb';
    const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

    const wrapWord = 'word-break:break-word;overflow-wrap:anywhere;';

    const detailRow = (label: string, value: string) => `
      <tr>
        <td style="padding:8px 0 8px 0;font-family:${FONT};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${MUTED};vertical-align:top;">${label}</td>
      </tr>
      <tr>
        <td style="padding:0 0 12px 0;font-family:${FONT};font-size:14px;color:${TEXT};font-weight:500;line-height:1.45;${wrapWord}">${value}</td>
      </tr>`;

    const featureItems = featureList.map(f => `
      <tr><td style="padding:3px 0;font-family:${FONT};font-size:13px;color:${TEXT};line-height:1.5;">
        <span style="color:#22c55e;font-weight:bold;">✓</span> ${esc(f)}
      </td></tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f7f9;font-family:${FONT};color:${TEXT};-webkit-text-size-adjust:100%;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f6f7f9;padding:20px 10px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
      <tr>
        <td style="background-color:${PRIMARY};padding:24px 24px;text-align:center;border-bottom:3px solid ${ACCENT};">
          <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,0.85);">Ride Ready Docs</div>
          <h1 style="margin:6px 0 0 0;font-family:${FONT};font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">Staff Invitation</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 24px 8px 24px;font-family:${FONT};font-size:15px;color:${TEXT};line-height:1.6;">
          <p style="margin:0 0 12px 0;">Hi there 👋</p>
          <p style="margin:0 0 16px 0;${wrapWord}"><strong style="${wrapWord}">${safeInviter}</strong> has invited you to join <strong style="${wrapWord}">${safeCompany}</strong> as a staff member on Ride Ready Docs.</p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 16px 0;border-top:1px solid ${BORDER};">
            <tr><td style="padding-top:12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${detailRow('Invited by', safeInviter)}
                ${detailRow('Organisation', safeCompany)}
                ${detailRow('Invited email', safeEmail)}
                ${detailRow('Role', 'Staff')}
                ${detailRow('Expires', safeExpires)}
              </table>
            </td></tr>
          </table>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eff6ff;border:1px solid #dbeafe;border-radius:8px;margin:8px 0 20px 0;">
            <tr><td style="padding:14px 16px;">
              <div style="font-family:${FONT};font-size:13px;font-weight:600;color:${TEXT};margin-bottom:6px;">Your access will include:</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${featureItems}</table>
            </td></tr>
          </table>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;">
            <tr><td align="center">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${inviteUrl}" style="height:46px;v-text-anchor:middle;width:240px;" arcsize="14%" strokecolor="${ACCENT}" fillcolor="${ACCENT}">
              <center style="color:#000000;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Accept Invitation</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${inviteUrl}" style="display:inline-block;background-color:${ACCENT};color:#000000;padding:14px 32px;text-decoration:none;border-radius:8px;font-family:${FONT};font-weight:bold;font-size:15px;line-height:1;mso-padding-alt:14px 32px;">Accept Invitation</a>
              <!--<![endif]-->
            </td></tr>
          </table>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fff8e1;border-left:3px solid ${ACCENT};border-radius:6px;margin:0 0 14px 0;">
            <tr><td style="padding:12px 14px;font-family:${FONT};font-size:13px;color:#555;line-height:1.5;">
              <strong>New to Ride Ready Docs?</strong> You'll create a password when you accept. If you already have an account with this email, just sign in on the invite page.
            </td></tr>
          </table>

          <p style="font-family:${FONT};font-size:12px;color:#999;margin:14px 0 4px 0;line-height:1.5;${wrapWord}">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color:${PRIMARY};${wrapWord}">${inviteUrl}</a>
          </p>

          <p style="font-family:${FONT};font-size:12px;color:#999;margin:14px 0 0 0;">
            If you didn't expect this invite, you can safely ignore this email.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px 20px 24px;background-color:#fafbfc;border-top:1px solid ${BORDER};text-align:center;font-family:${FONT};font-size:11px;color:${MUTED};line-height:1.5;">
          Sent by Ride Ready Docs &middot; <a href="https://ridereadydocs.com" style="color:${PRIMARY};text-decoration:none;">ridereadydocs.com</a>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

    const emailResponse = await auditedResendSend(resend, {
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: [email],
      subject,
      html,
    }, {
      function_name: 'send-staff-invite',
      template_name: 'staff-invite',
      user_id: user.id,
      metadata: { organisation_id: organisation.id, permission_level: permissionLevel },
    });

    if ((emailResponse as any)?.error) {
      console.error("Staff invite email send error:", (emailResponse as any).error);

      if (inviteIdForCleanup) {
        await supabase.from("staff_invites").delete().eq("id", inviteIdForCleanup);
      }

      return new Response(
        JSON.stringify({ error: (emailResponse as any).error?.message || "Failed to send invite email" }),
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
