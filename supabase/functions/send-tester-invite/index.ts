import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { logEmailSend } from "../_shared/email-logger.ts";
import { auditedResendSend } from "../_shared/resend-audit.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface TesterInviteRequest {
  email: string;
  inviterName?: string;
  expiryDays?: number;
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const effectiveExpiryDays = typeof expiryDays === "number" ? expiryDays : 7;
    const computedExpiresAt =
      effectiveExpiryDays === 0
        ? null
        : new Date(Date.now() + effectiveExpiryDays * msPerDay).toISOString();

    const { data: existingInvite } = await supabase
      .from("tester_invites")
      .select("id, status, invite_token, expires_at")
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite?.expires_at && new Date(existingInvite.expires_at) < new Date()) {
      await supabase
        .from("tester_invites")
        .update({ status: "expired" })
        .eq("id", existingInvite.id);
    }

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

    let inviteIdForCleanup: string | null = null;
    let invite: { id: string; invite_token: string; expires_at: string | null } | null = null;

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

    const baseUrl = "https://ridereadydocs.com";
    const inviteUrl = `${baseUrl}/tester-invite/${invite.invite_token}`;
    const subject = "You're invited to be a Tester! 🧪";

    // ---- Email HTML — fully inline, mobile-safe, Gmail-safe ----
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    const safeInviter = inviterName ? esc(inviterName) : '';
    const PRIMARY = '#1F3A5F';
    const ACCENT = '#FCBA04';
    const TEXT = '#1f2937';
    const MUTED = '#6b7280';
    const BORDER = '#e5e7eb';
    const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
    const wrapWord = 'word-break:break-word;overflow-wrap:anywhere;';

    const benefits = [
      'Get early access to new features',
      'See a "Test Mode" banner showing the current app version',
      'Have special tools to reset your test data',
      'Help us improve the app for everyone',
    ];
    const benefitRows = benefits.map(b => `
      <tr><td style="padding:4px 0;font-family:${FONT};font-size:14px;color:${TEXT};line-height:1.5;">
        <span style="color:#22c55e;font-weight:bold;">✓</span> ${esc(b)}
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
          <h1 style="margin:6px 0 8px 0;font-family:${FONT};font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">🧪 You're Invited to Test!</h1>
          <span style="display:inline-block;background-color:${ACCENT};color:#000000;padding:4px 10px;border-radius:4px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.5px;">TESTER INVITE</span>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 24px 8px 24px;font-family:${FONT};font-size:15px;color:${TEXT};line-height:1.6;">
          <p style="margin:0 0 12px 0;">Hi there!</p>
          <p style="margin:0 0 16px 0;${wrapWord}">${safeInviter ? `<strong style="${wrapWord}">${safeInviter}</strong> has` : 'You have been'} invited you to join <strong>Ride Ready Docs</strong> as a tester.</p>

          <p style="margin:0 0 8px 0;font-family:${FONT};font-size:14px;color:${TEXT};font-weight:600;">As a tester, you'll:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px 0;">${benefitRows}</table>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;">
            <tr><td align="center">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${inviteUrl}" style="height:46px;v-text-anchor:middle;width:240px;" arcsize="14%" strokecolor="${ACCENT}" fillcolor="${ACCENT}">
              <center style="color:#000000;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Accept Tester Invite</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${inviteUrl}" style="display:inline-block;background-color:${ACCENT};color:#000000;padding:14px 28px;text-decoration:none;border-radius:8px;font-family:${FONT};font-weight:bold;font-size:15px;line-height:1;mso-padding-alt:14px 28px;">Accept Tester Invite</a>
              <!--<![endif]-->
            </td></tr>
          </table>

          <p style="font-family:${FONT};font-size:12px;color:${MUTED};margin:14px 0 4px 0;line-height:1.5;${wrapWord}">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color:${PRIMARY};${wrapWord}">${inviteUrl}</a>
          </p>

          <p style="font-family:${FONT};font-size:13px;color:${MUTED};margin:14px 0 0 0;">
            This invite expires in 7 days. If you didn't expect this invite, you can safely ignore this email.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px 20px 24px;background-color:#fafbfc;border-top:1px solid ${BORDER};text-align:center;font-family:${FONT};font-size:11px;color:${MUTED};line-height:1.5;">
          Ride Ready Docs &middot; <a href="https://ridereadydocs.com" style="color:${PRIMARY};text-decoration:none;">ridereadydocs.com</a>
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
      function_name: 'send-tester-invite',
      template_name: 'tester-invite',
      user_id: user.id,
    });

    if ((emailResponse as any)?.error) {
      console.error("Tester invite email send error:", (emailResponse as any).error);

      if (inviteIdForCleanup) {
        await supabase.from("tester_invites").delete().eq("id", inviteIdForCleanup);
      }

      return new Response(
        JSON.stringify({ error: (emailResponse as any).error?.message || "Failed to send invite email" }),
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
