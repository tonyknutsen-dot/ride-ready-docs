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

interface Document {
  id: string;
  document_name: string;
  document_type: string;
  expires_at: string;
  user_id: string;
  ride_id: string | null;
}

interface Profile {
  user_id: string;
  company_name: string | null;
  subscription_status: string | null;
}

interface User {
  id: string;
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date and calculate 30 days and 7 days from now
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    // Format dates as YYYY-MM-DD
    const thirtyDaysDate = thirtyDaysFromNow.toISOString().split('T')[0];
    const sevenDaysDate = sevenDaysFromNow.toISOString().split('T')[0];

    console.log('Checking for documents expiring on:', { thirtyDaysDate, sevenDaysDate });

    // Fetch documents expiring in 30 days or 7 days (only for basic plan users)
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, document_name, document_type, expires_at, user_id, ride_id')
      .not('expires_at', 'is', null)
      .or(`expires_at.eq.${thirtyDaysDate},expires_at.eq.${sevenDaysDate}`)
      .order('expires_at');

    if (docsError) {
      console.error('Error fetching documents:', docsError);
      throw docsError;
    }

    if (!documents || documents.length === 0) {
      console.log('No documents expiring in 30 or 7 days');
      return new Response(
        JSON.stringify({ message: 'No expiring documents found' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${documents.length} expiring documents`);

    // Group documents by user
    const documentsByUser = documents.reduce((acc, doc) => {
      if (!acc[doc.user_id]) {
        acc[doc.user_id] = [];
      }
      acc[doc.user_id].push(doc);
      return acc;
    }, {} as Record<string, Document[]>);

    let emailsSent = 0;
    let emailsFailed = 0;

    // Process each user's expiring documents
    for (const [userId, userDocs] of Object.entries(documentsByUser)) {
      try {
        // Get user profile to check subscription status
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, company_name, subscription_status')
          .eq('user_id', userId)
          .single();

        // Only send to basic plan users (advanced users have calendar)
        if (!profile || profile.subscription_status !== 'basic') {
          console.log(`Skipping user ${userId} - not on basic plan`);
          continue;
        }

        // Get user email from auth
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
        
        if (userError || !user?.email) {
          console.error(`Could not fetch user email for ${userId}:`, userError);
          emailsFailed++;
          continue;
        }

        // Get ride names if applicable
        const rideIds = userDocs.filter(d => d.ride_id).map(d => d.ride_id);
        const rideNames: Record<string, string> = {};
        
        if (rideIds.length > 0) {
          const { data: rides } = await supabase
            .from('rides')
            .select('id, ride_name')
            .in('id', rideIds);
          
          if (rides) {
            rides.forEach(ride => {
              rideNames[ride.id] = ride.ride_name;
            });
          }
        }

        // Group by expiry period
        const thirtyDayDocs = userDocs.filter(d => d.expires_at === thirtyDaysDate);
        const sevenDayDocs = userDocs.filter(d => d.expires_at === sevenDaysDate);

        // Build email content
        let emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Document Expiry Reminder</h1>
            <p>Hello${profile.company_name ? ` ${profile.company_name}` : ''},</p>
            <p>This is a reminder that you have documents expiring soon:</p>
        `;

        if (thirtyDayDocs.length > 0) {
          emailContent += `
            <div style="margin: 20px 0; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b;">
              <h2 style="color: #92400e; margin-top: 0;">Expiring in 30 Days (${thirtyDaysDate})</h2>
              <ul style="list-style-type: none; padding: 0;">
          `;
          
          thirtyDayDocs.forEach(doc => {
            const rideName = doc.ride_id ? rideNames[doc.ride_id] : null;
            emailContent += `
              <li style="margin: 10px 0; padding: 10px; background-color: white; border-radius: 4px;">
                <strong>${doc.document_name}</strong><br/>
                <span style="color: #666;">Type: ${doc.document_type}</span><br/>
                ${rideName ? `<span style="color: #666;">Ride: ${rideName}</span><br/>` : ''}
                <span style="color: #f59e0b;">Expires: ${doc.expires_at}</span>
              </li>
            `;
          });
          
          emailContent += `
              </ul>
            </div>
          `;
        }

        if (sevenDayDocs.length > 0) {
          emailContent += `
            <div style="margin: 20px 0; padding: 15px; background-color: #fee2e2; border-left: 4px solid #dc2626;">
              <h2 style="color: #991b1b; margin-top: 0;">⚠️ Expiring in 7 Days (${sevenDaysDate})</h2>
              <ul style="list-style-type: none; padding: 0;">
          `;
          
          sevenDayDocs.forEach(doc => {
            const rideName = doc.ride_id ? rideNames[doc.ride_id] : null;
            emailContent += `
              <li style="margin: 10px 0; padding: 10px; background-color: white; border-radius: 4px;">
                <strong>${doc.document_name}</strong><br/>
                <span style="color: #666;">Type: ${doc.document_type}</span><br/>
                ${rideName ? `<span style="color: #666;">Ride: ${rideName}</span><br/>` : ''}
                <span style="color: #dc2626;">Expires: ${doc.expires_at}</span>
              </li>
            `;
          });
          
          emailContent += `
              </ul>
            </div>
          `;
        }

        emailContent += `
            <p style="margin-top: 20px;">Please take action to renew these documents before they expire.</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              This is an automated reminder from your document management system.
            </p>
          </div>
        `;

        // Send email
        const emailResponse = await resend.emails.send({
          from: "RideTrack <onboarding@resend.dev>",
          to: [user.email],
          subject: `Document Expiry Reminder - ${thirtyDayDocs.length + sevenDayDocs.length} Document(s) Expiring Soon`,
          html: emailContent,
        });

        console.log(`Email sent to ${user.email}:`, emailResponse);
        emailsSent++;

      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        emailsFailed++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Document expiry reminders processed',
        emailsSent,
        emailsFailed,
        totalDocuments: documents.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in send-document-expiry-reminders:", error);
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
