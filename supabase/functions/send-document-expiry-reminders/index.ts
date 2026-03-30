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
const warning = '#f59e0b';
const danger = '#dc2626';

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

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const thirtyDaysDate = thirtyDaysFromNow.toISOString().split('T')[0];
    const sevenDaysDate = sevenDaysFromNow.toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();

    console.log('Checking for documents expiring on:', { thirtyDaysDate, sevenDaysDate });

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

    const documentsByUser = documents.reduce((acc, doc) => {
      if (!acc[doc.user_id]) acc[doc.user_id] = [];
      acc[doc.user_id].push(doc);
      return acc;
    }, {} as Record<string, Document[]>);

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const [userId, userDocs] of Object.entries(documentsByUser)) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, company_name, subscription_status')
          .eq('user_id', userId)
          .single();

        if (!profile || profile.subscription_status !== 'basic') {
          console.log(`Skipping user ${userId} - not on basic plan`);
          continue;
        }

        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
        
        if (userError || !user?.email) {
          console.error(`Could not fetch user email for ${userId}:`, userError);
          emailsFailed++;
          continue;
        }

        const rideIds = userDocs.filter(d => d.ride_id).map(d => d.ride_id);
        const rideNames: Record<string, string> = {};
        
        if (rideIds.length > 0) {
          const { data: rides } = await supabase
            .from('rides')
            .select('id, ride_name')
            .in('id', rideIds);
          
          if (rides) {
            rides.forEach(ride => { rideNames[ride.id] = ride.ride_name; });
          }
        }

        const thirtyDayDocs = userDocs.filter(d => d.expires_at === thirtyDaysDate);
        const sevenDayDocs = userDocs.filter(d => d.expires_at === sevenDaysDate);

        let documentsHtml = '';

        if (sevenDayDocs.length > 0) {
          documentsHtml += `
            <div style="background: #fef2f2; border-left: 4px solid ${danger}; padding: 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
              <div style="display: inline-block; background: ${danger}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
                ⚠️ EXPIRING IN 7 DAYS
              </div>
              ${sevenDayDocs.map(doc => {
                const rideName = doc.ride_id ? rideNames[doc.ride_id] : null;
                return `
                  <div style="background: white; border: 1px solid #fecaca; border-radius: 6px; padding: 12px 16px; margin-bottom: 8px;">
                    <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600;">${doc.document_name}</p>
                    <p style="margin: 0; font-size: 13px; color: #6b7280;">
                      ${doc.document_type}${rideName ? ` · ${rideName}` : ''}
                    </p>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }

        if (thirtyDayDocs.length > 0) {
          documentsHtml += `
            <div style="background: #fffbeb; border-left: 4px solid ${warning}; padding: 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
              <div style="display: inline-block; background: ${warning}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
                EXPIRING IN 30 DAYS
              </div>
              ${thirtyDayDocs.map(doc => {
                const rideName = doc.ride_id ? rideNames[doc.ride_id] : null;
                return `
                  <div style="background: white; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 16px; margin-bottom: 8px;">
                    <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600;">${doc.document_name}</p>
                    <p style="margin: 0; font-size: 13px; color: #6b7280;">
                      ${doc.document_type}${rideName ? ` · ${rideName}` : ''}
                    </p>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Expiry Reminder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${primary} 0%, ${primaryLight} 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 24px;">📄</span>
      </div>
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Document Expiry Reminder</h1>
      <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">${sevenDayDocs.length + thirtyDayDocs.length} document(s) expiring soon</p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
      <p style="margin-top: 0; font-size: 16px;">Hello${profile.company_name ? ` ${profile.company_name}` : ''},</p>
      
      <p style="font-size: 15px;">This is a reminder that some of your documents are expiring soon. Please take action to renew them before they expire.</p>
      
      ${documentsHtml}
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://ridereadydocs.com/overview" style="display: inline-block; background: linear-gradient(135deg, ${primary} 0%, ${primaryLight} 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View Documents</a>
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
          subject: `📄 Document Expiry Reminder - ${thirtyDayDocs.length + sevenDayDocs.length} Document(s) Expiring Soon`,
          html,
        });

        console.log(`Email sent to ${user.email}:`, emailResponse);
        emailsSent++;

      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        emailsFailed++;
      }
    }

    return new Response(
      JSON.stringify({ message: 'Document expiry reminders processed', emailsSent, emailsFailed, totalDocuments: documents.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-document-expiry-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
