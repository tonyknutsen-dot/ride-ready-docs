import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting inspection reminder check...");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Fetch all active inspection schedules
    const { data: schedules, error: schedulesError } = await supabase
      .from("inspection_schedules")
      .select(`
        *,
        rides (
          ride_name
        )
      `)
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
        // Calculate days until due
        const dueDate = new Date(schedule.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if we should send a notification
        const shouldNotify = daysUntilDue <= schedule.advance_notice_days && daysUntilDue >= 0;
        
        // Check if we already sent a notification today
        const lastSent = schedule.last_notification_sent 
          ? new Date(schedule.last_notification_sent) 
          : null;
        const alreadySentToday = lastSent && lastSent.toDateString() === today.toDateString();

        if (shouldNotify && !alreadySentToday) {
          console.log(`Sending reminder for schedule: ${schedule.inspection_name}`);
          
          // Get user email from auth.users
          const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(schedule.user_id);
          
          if (userError || !user?.email) {
            console.error(`Could not find user email for user_id: ${schedule.user_id}`);
            errors.push({ schedule_id: schedule.id, error: "User email not found" });
            continue;
          }

          // Get profile info for company name
          const { data: profile } = await supabase
            .from("profiles")
            .select("company_name")
            .eq("user_id", schedule.user_id)
            .single();

          const rideName = schedule.rides?.ride_name || "Unknown Ride";
          const companyName = profile?.company_name || "Your Company";
          
          // Send email
          const emailResponse = await resend.emails.send({
            from: "RideTracker <onboarding@resend.dev>",
            to: [user.email],
            subject: `Inspection Reminder: ${schedule.inspection_name} - ${rideName}`,
            html: `
              <h1>Inspection Reminder</h1>
              <p>Hello ${companyName},</p>
              <p>This is a reminder that the following inspection is due soon:</p>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Ride:</strong> ${rideName}</p>
                <p><strong>Inspection Type:</strong> ${schedule.inspection_type}</p>
                <p><strong>Inspection Name:</strong> ${schedule.inspection_name}</p>
                <p><strong>Due Date:</strong> ${new Date(schedule.due_date).toLocaleDateString()}</p>
                <p><strong>Days Until Due:</strong> ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}</p>
                ${schedule.notes ? `<p><strong>Notes:</strong> ${schedule.notes}</p>` : ''}
              </div>
              <p>Please ensure this inspection is completed on time to maintain compliance.</p>
              <p>Best regards,<br>RideTracker Team</p>
            `,
          });

          console.log("Email sent successfully:", emailResponse);

          // Update last_notification_sent
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
      JSON.stringify({ 
        success: true, 
        emailsSent, 
        errors: errors.length > 0 ? errors : undefined 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-inspection-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
