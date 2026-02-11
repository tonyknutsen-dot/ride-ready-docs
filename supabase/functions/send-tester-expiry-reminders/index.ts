import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { generateEmailWrapper, emailStyles, escapeHtml } from "../_shared/email-template.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    console.log("Starting tester expiry reminder check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the date 3 days from now
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    // Get start and end of that day for the query
    const startOfDay = new Date(threeDaysFromNow);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(threeDaysFromNow);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`Looking for tester roles expiring between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

    // Find tester roles expiring in 3 days
    const { data: expiringRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, expires_at")
      .eq("role", "tester")
      .gte("expires_at", startOfDay.toISOString())
      .lte("expires_at", endOfDay.toISOString());

    if (rolesError) {
      console.error("Error fetching expiring roles:", rolesError);
      throw rolesError;
    }

    console.log(`Found ${expiringRoles?.length || 0} tester roles expiring in 3 days`);

    if (!expiringRoles || expiringRoles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expiring tester roles found", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailsSent: string[] = [];
    const errors: string[] = [];

    for (const role of expiringRoles) {
      try {
        // Get user email from auth.users
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(role.user_id);

        if (userError || !userData?.user?.email) {
          console.error(`Could not get email for user ${role.user_id}:`, userError);
          errors.push(`User ${role.user_id}: Could not retrieve email`);
          continue;
        }

        const userEmail = userData.user.email;
        const expiryDate = new Date(role.expires_at!);
        const formattedDate = expiryDate.toLocaleDateString('en-GB', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        // Generate email content
        const emailContent = `
          <p style="font-size: 16px; margin-bottom: 24px;">
            Your tester access to <strong>Ride Ready Docs</strong> will expire in 3 days.
          </p>
          
          <div style="${emailStyles.warningBox}">
            <p style="margin: 0; font-weight: 600; color: #92400e;">Access Expiry Notice</p>
            <p style="margin: 8px 0 0 0; color: #92400e;">
              Your tester access will expire on:<br>
              <strong>${escapeHtml(formattedDate)}</strong>
            </p>
          </div>
          
          <p style="font-size: 15px; margin: 24px 0;">
            After this date, you will no longer have access to premium features unless you:
          </p>
          
          <ul style="font-size: 15px; line-height: 1.8; margin: 16px 0; padding-left: 24px;">
            <li>Subscribe to one of our paid plans</li>
            <li>Request an extension from the administrator</li>
          </ul>
          
          <div style="${emailStyles.infoBox}">
            <p style="margin: 0; font-size: 14px;">
              <strong>Need more time?</strong><br>
              Contact us if you need your tester access extended for continued testing.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 32px;">
            <a href="https://ridereadydocs.com/plan-billing" style="${emailStyles.button}">
              View Subscription Options
            </a>
          </div>
          
          <hr style="${emailStyles.divider}">
          
          <p style="font-size: 13px; color: #6b7280; text-align: center;">
            Thank you for testing Ride Ready Docs. Your feedback helps us improve!
          </p>
        `;

        const html = generateEmailWrapper(
          "Tester Access Expiring Soon",
          "Your access will expire in 3 days",
          emailContent
        );

        // Send email
        const emailResponse = await resend.emails.send({
          from: "Ride Ready Docs <noreply@ridereadydocs.com>",
          to: [userEmail],
          subject: "Your Tester Access Expires in 3 Days - Ride Ready Docs",
          html,
        });

        console.log(`Email sent to ${userEmail}:`, emailResponse);
        emailsSent.push(userEmail);
      } catch (emailError: any) {
        console.error(`Error sending email for user ${role.user_id}:`, emailError);
        errors.push(`User ${role.user_id}: ${emailError.message}`);
      }
    }

    const result = {
      message: "Tester expiry reminder check complete",
      emailsSent: emailsSent.length,
      emailAddresses: emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("Tester expiry reminder result:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-tester-expiry-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
