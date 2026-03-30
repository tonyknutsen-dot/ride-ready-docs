import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { generateEmailWrapper, emailStyles, brandColors } from "../_shared/email-template.ts";
import { logEmailSend } from "../_shared/email-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

    console.log("[TRIAL-EXTENSION] Starting trial extension check...");

    // Find users whose 14-day trial expired in the last 24 hours
    // and who haven't already been extended (trial_ends_at is still ~14 days from start)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: expiredTrials, error: fetchError } = await supabase
      .from('profiles')
      .select('user_id, trial_started_at, trial_ends_at, subscription_status, company_name')
      .eq('subscription_status', 'trial')
      .lt('trial_ends_at', now.toISOString())
      .gt('trial_ends_at', oneDayAgo.toISOString());

    if (fetchError) {
      console.error("[TRIAL-EXTENSION] Error fetching expired trials:", fetchError);
      throw fetchError;
    }

    console.log(`[TRIAL-EXTENSION] Found ${expiredTrials?.length || 0} recently expired trials`);

    let emailsSent = 0;
    let trialsExtended = 0;

    for (const profile of expiredTrials || []) {
      // Check the trial was roughly 14 days (not already extended to 21)
      const trialStart = new Date(profile.trial_started_at);
      const trialEnd = new Date(profile.trial_ends_at);
      const trialDays = Math.round((trialEnd.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));

      // Only extend if the trial was ~14 days (not already extended)
      if (trialDays > 17) {
        console.log(`[TRIAL-EXTENSION] Skipping ${profile.user_id} - already extended (${trialDays} days)`);
        continue;
      }

      // Get user email from auth
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.user_id);
      if (userError || !userData?.user?.email) {
        console.error(`[TRIAL-EXTENSION] Could not get email for user ${profile.user_id}:`, userError);
        continue;
      }

      const userEmail = userData.user.email;
      const userName = profile.company_name || 'there';

      // Extend trial to 21 days from original start
      const newTrialEnd = new Date(trialStart.getTime() + 21 * 24 * 60 * 60 * 1000);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          trial_ends_at: newTrialEnd.toISOString(),
          subscription_status: 'trial',
        })
        .eq('user_id', profile.user_id);

      if (updateError) {
        console.error(`[TRIAL-EXTENSION] Error extending trial for ${profile.user_id}:`, updateError);
        continue;
      }

      trialsExtended++;
      console.log(`[TRIAL-EXTENSION] Extended trial for ${profile.user_id} to ${newTrialEnd.toISOString()}`);

      // Send the extension email
      const emailContent = `
        <p style="font-size: 16px; margin-top: 0;">Hi ${userName},</p>
        
        <p style="font-size: 15px;">We noticed your free trial of <strong>Ride Ready Docs</strong> has just come to an end — and we completely understand that 14 days isn't always enough time to fully explore everything the platform has to offer.</p>
        
        <p style="font-size: 15px;">Between managing your day-to-day operations, keeping on top of inspections, and running your business, we know how quickly time flies. That's why we've decided to <strong>extend your trial by an extra 7 days — completely free</strong>.</p>

        <div style="${emailStyles.successBox}">
          <h3 style="margin: 0 0 8px 0; color: ${brandColors.success}; font-size: 15px;">✅ Your Trial Has Been Extended</h3>
          <p style="margin: 0; font-size: 14px; color: ${brandColors.text};">
            You now have <strong>7 more days</strong> of full access to all features — no action needed on your part. Just log back in and pick up where you left off.
          </p>
        </div>
        
        <p style="font-size: 15px;">We want to make sure you've had a proper chance to see how Ride Ready Docs can help you:</p>
        
        <ul style="padding-left: 20px; color: #374151; font-size: 15px;">
          <li style="margin-bottom: 8px;">Stay compliant with daily, weekly & annual checks</li>
          <li style="margin-bottom: 8px;">Keep all your certificates and documents organised</li>
          <li style="margin-bottom: 8px;">Track maintenance and defect history effortlessly</li>
          <li style="margin-bottom: 0;">Generate professional reports in seconds</li>
        </ul>

        <div style="text-align: center; margin: 32px 0;">
          <a href="https://ridereadydocs.com/overview" style="${emailStyles.button}">Continue Your Trial →</a>
        </div>
        
        <hr style="${emailStyles.divider}">
        
        <p style="font-size: 14px; color: ${brandColors.textLight};">
          If you have any questions or need a hand getting set up, just reply to this email or drop us a message at 
          <a href="mailto:info@ridereadydocs.com" style="color: ${brandColors.primary}; text-decoration: none;">info@ridereadydocs.com</a>. 
          We're always happy to help.
        </p>
      `;

      const html = generateEmailWrapper(
        "We've Extended Your Trial!",
        "More time to explore Ride Ready Docs",
        emailContent
      );

      try {
        await resend.emails.send({
          from: "Ride Ready Docs <info@ridereadydocs.com>",
          to: [userEmail],
          subject: "Good news — we've extended your free trial! 🎡",
          html,
        });
        emailsSent++;
        console.log(`[TRIAL-EXTENSION] Extension email sent to ${userEmail}`);
      } catch (emailError) {
        console.error(`[TRIAL-EXTENSION] Failed to send email to ${userEmail}:`, emailError);
      }
    }

    console.log(`[TRIAL-EXTENSION] Complete. Extended: ${trialsExtended}, Emails sent: ${emailsSent}`);

    return new Response(JSON.stringify({ 
      success: true, 
      trialsExtended, 
      emailsSent 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[TRIAL-EXTENSION] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
