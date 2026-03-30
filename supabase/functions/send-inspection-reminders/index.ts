import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { logEmailSend } from "../_shared/email-logger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Brand colors
const primary = '#1e4a8f';
const primaryLight = '#2563eb';
const accent = '#f59e0b';
const warning = '#f59e0b';

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    console.log("Starting inspection reminder check...");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = new Date().getFullYear();
    
    const { data: schedules, error: schedulesError } = await supabase
      .from("inspection_schedules")
      .select(`*, rides (ride_name)`)
      .eq("is_active", true);

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} active schedules`);

    let emailsSent = 0;
    const errors: any[] = [];

    for (const schedule of schedules || []) {
      try {
        const dueDate = new Date(schedule.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        const shouldNotify = daysUntilDue <= schedule.advance_notice_days && daysUntilDue >= 0;
        
        const lastSent = schedule.last_notification_sent ? new Date(schedule.last_notification_sent) : null;
        const alreadySentToday = lastSent && lastSent.toDateString() === today.toDateString();

        if (shouldNotify && !alreadySentToday) {
          console.log(`Sending reminder for schedule: ${schedule.inspection_name}`);
          
          const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(schedule.user_id);
          
          if (userError || !user?.email) {
            console.error(`Could not find user email for user_id: ${schedule.user_id}`);
            errors.push({ schedule_id: schedule.id, error: "User email not found" });
            continue;
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("company_name")
            .eq("user_id", schedule.user_id)
            .single();

          const rideName = schedule.rides?.ride_name || "Unknown Ride";
          const companyName = profile?.company_name || "there";
          const urgencyColor = daysUntilDue <= 7 ? '#dc2626' : warning;
          const urgencyBg = daysUntilDue <= 7 ? '#fef2f2' : '#fffbeb';
          
          const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inspection Reminder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${primary} 0%, ${primaryLight} 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 24px;">🔔</span>
      </div>
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Inspection Reminder</h1>
      <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">${rideName}</p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
      <p style="margin-top: 0; font-size: 16px;">Hello ${companyName},</p>
      
      <p style="font-size: 15px;">This is a reminder that an inspection is due soon:</p>
      
      <div style="background: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; padding: 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
        <div style="display: inline-block; background: ${urgencyColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 12px;">
          ${daysUntilDue === 0 ? 'DUE TODAY' : daysUntilDue === 1 ? 'DUE TOMORROW' : `${daysUntilDue} DAYS REMAINING`}
        </div>
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #1f2937;">${schedule.inspection_name}</p>
      </div>
      
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Ride</p>
          <p style="margin: 0; font-size: 15px; font-weight: 600; color: ${primary};">${rideName}</p>
        </div>
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Inspection Type</p>
          <p style="margin: 0; font-size: 14px;">${schedule.inspection_type}</p>
        </div>
        <div>
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Due Date</p>
          <p style="margin: 0; font-size: 14px;">${new Date(schedule.due_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        ${schedule.notes ? `
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Notes</p>
          <p style="margin: 0; font-size: 14px;">${schedule.notes}</p>
        </div>
        ` : ''}
      </div>
      
      <p style="font-size: 15px;">Please ensure this inspection is completed on time to maintain compliance.</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://ridereadydocs.com/overview" style="display: inline-block; background: linear-gradient(135deg, ${primary} 0%, ${primaryLight} 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View in Dashboard</a>
      </div>
      
      <p style="margin-top: 24px; margin-bottom: 0;">Best regards,<br><strong>Ride Ready Docs Team</strong></p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f9fafb; padding: 30px 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.8;">
        © ${currentYear} Ride Ready Docs. All rights reserved.<br>
        <a href="https://ridereadydocs.com" style="color: ${primary}; text-decoration: none;">ridereadydocs.com</a>
      </p>
    </div>
  </div>
</body>
</html>
          `;

          const emailResponse = await resend.emails.send({
            from: "Ride Ready Docs <info@ridereadydocs.com>",
            to: [user.email],
            subject: `🔔 Inspection Reminder: ${schedule.inspection_name} - ${rideName}`,
            html,
          });

          console.log("Email sent successfully:", emailResponse);
          const reminderSubject = `🔔 Inspection Reminder: ${schedule.inspection_name} - ${rideName}`;
          await logEmailSend({ template_name: 'inspection-reminder', recipient_email: user.email, subject: reminderSubject, status: 'sent', user_id: schedule.user_id, metadata: { schedule_id: schedule.id, days_until_due: daysUntilDue } });

          await supabase
            .from("inspection_schedules")
            .update({ last_notification_sent: new Date().toISOString() })
            .eq("id", schedule.id);

          emailsSent++;
        }
      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error);
        errors.push({ schedule_id: schedule.id, error: error.message });
      }
    }

    console.log(`Completed. Emails sent: ${emailsSent}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ success: true, emailsSent, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-inspection-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
