import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    // Only send reminders during daytime hours (8am-8pm UK time)
    const ukHour = new Date().toLocaleString("en-GB", { timeZone: "Europe/London", hour: "numeric", hour12: false });
    const currentHour = parseInt(ukHour, 10);
    if (currentHour < 8 || currentHour >= 20) {
      console.log(`Outside daytime hours (current UK hour: ${currentHour}). Skipping reminders.`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Outside daytime hours (8am-8pm UK)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[STAFF-INVITE-EXPIRY] Starting expiry reminder check...");

    // Find pending invites expiring in the next 24 hours that haven't been reminded
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: expiringInvites, error: fetchError } = await supabase
      .from("staff_invites")
      .select(`
        id,
        email,
        expires_at,
        invite_token,
        permission_level,
        organisation_id,
        invited_by,
        expiry_reminder_sent
      `)
      .eq("status", "pending")
      .lte("expires_at", in24Hours.toISOString())
      .gt("expires_at", now.toISOString())
      .or("expiry_reminder_sent.is.null,expiry_reminder_sent.eq.false");

    if (fetchError) {
      console.error("[STAFF-INVITE-EXPIRY] Error fetching invites:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch expiring invites" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[STAFF-INVITE-EXPIRY] Found ${expiringInvites?.length || 0} expiring invites`);

    if (!expiringInvites || expiringInvites.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expiring invites to process", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const invite of expiringInvites) {
      try {
        // Get organisation details
        const { data: org } = await supabase
          .from("organisations")
          .select("name")
          .eq("id", invite.organisation_id)
          .single();

        // Get inviter's profile
        const { data: inviterProfile } = await supabase
          .from("profiles")
          .select("controller_name, company_name")
          .eq("user_id", invite.invited_by)
          .single();

        const companyName = inviterProfile?.company_name || org?.name || "Your employer";
        const expiresAt = new Date(invite.expires_at);
        const hoursRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000));

        const baseUrl = "https://ride-ready-docs.lovable.app";
        const inviteUrl = `${baseUrl}/staff-invite/${invite.invite_token}`;

        // Send expiry reminder email
        const emailResponse = await resend.emails.send({
          from: "Ride Ready Docs <info@ridereadydocs.com>",
          to: [invite.email],
          subject: `⏰ Your staff invite expires soon - ${companyName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #FF6B35, #F7931A); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; background: #1F3A5F; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                .warning-box { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin: 15px 0; }
                .time-badge { display: inline-block; background: #dc3545; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>⏰ Invite Expiring Soon!</h1>
                  <span class="time-badge">${hoursRemaining} hours remaining</span>
                </div>
                <div class="content">
                  <p>Hi there!</p>
                  
                  <div class="warning-box">
                    <p style="margin: 0;"><strong>Your invitation to join ${companyName}</strong> on Ride Ready Docs will expire in <strong>${hoursRemaining} hours</strong>.</p>
                  </div>

                  <p>Don't miss out! Click the button below to accept your invitation before it expires:</p>

                  <p style="text-align: center;">
                    <a href="${inviteUrl}" class="button">Accept Invitation Now</a>
                  </p>
                  
                  <p style="font-size: 14px; color: #666;">
                    After the invite expires, you'll need to ask ${companyName} to send you a new invitation.
                  </p>
                </div>
                <div class="footer">
                  <p>Ride Ready Docs - Safety Documentation for Amusement Professionals</p>
                </div>
              </div>
            </body>
            </html>
          `,
        });

        if ((emailResponse as any)?.error) {
          console.error(`[STAFF-INVITE-EXPIRY] Failed to send to ${invite.email}:`, (emailResponse as any).error);
          errors.push(`${invite.email}: ${(emailResponse as any).error.message}`);
          continue;
        }

        // Mark as reminded
        await supabase
          .from("staff_invites")
          .update({ expiry_reminder_sent: true })
          .eq("id", invite.id);

        sentCount++;
        console.log(`[STAFF-INVITE-EXPIRY] Sent reminder to ${invite.email}`);
      } catch (inviteError: any) {
        console.error(`[STAFF-INVITE-EXPIRY] Error processing invite ${invite.id}:`, inviteError);
        errors.push(`${invite.email}: ${inviteError.message}`);
      }
    }

    // Also expire any past-due invites
    const { data: expiredInvites } = await supabase
      .from("staff_invites")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", now.toISOString())
      .select("id");

    console.log(`[STAFF-INVITE-EXPIRY] Marked ${expiredInvites?.length || 0} invites as expired`);

    return new Response(
      JSON.stringify({
        message: "Expiry reminder check complete",
        remindersSent: sentCount,
        invitesExpired: expiredInvites?.length || 0,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[STAFF-INVITE-EXPIRY] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
