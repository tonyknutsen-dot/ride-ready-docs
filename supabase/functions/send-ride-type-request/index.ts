import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand colors
const primary = '#1e4a8f';
const primaryLight = '#2563eb';
const success = '#16a34a';

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

interface RideTypeRequest {
  name: string;
  type: 'ride' | 'stall' | 'service';
  description: string;
  manufacturer?: string;
  additionalInfo?: string;
  userEmail: string;
  userName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: RideTypeRequest = await req.json();
    
    console.log('Received ride type request:', {
      name: requestData.name,
      type: requestData.type,
      userEmail: requestData.userEmail
    });

    if (!requestData.name || !requestData.type || !requestData.description || !requestData.userEmail) {
      throw new Error('Missing required fields');
    }

    const safeName = escapeHtml(requestData.name);
    const safeDescription = escapeHtml(requestData.description);
    const safeManufacturer = escapeHtml(requestData.manufacturer);
    const safeAdditionalInfo = escapeHtml(requestData.additionalInfo);
    const safeUserEmail = escapeHtml(requestData.userEmail);
    const safeUserName = escapeHtml(requestData.userName);
    const currentYear = new Date().getFullYear();

    const typeLabel = requestData.type === 'ride' ? 'Fairground Ride' : 
                     requestData.type === 'stall' ? 'Food/Game Stall' : 'Generator/Equipment';

    // Admin notification email
    const adminHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New ${typeLabel} Type Request</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${primary} 0%, ${primaryLight} 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">🎡 New ${typeLabel} Request</h1>
      <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">A user has requested a new equipment type</p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
      <div style="background: #eff6ff; border-left: 4px solid ${primary}; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${primary};">Requested ${typeLabel}</p>
        <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1f2937;">${safeName}</p>
      </div>
      
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Type</p>
          <p style="margin: 0; font-size: 14px;">${typeLabel}</p>
        </div>
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Description</p>
          <p style="margin: 0; font-size: 14px;">${safeDescription}</p>
        </div>
        ${safeManufacturer ? `
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Manufacturer</p>
          <p style="margin: 0; font-size: 14px;">${safeManufacturer}</p>
        </div>
        ` : ''}
        ${safeAdditionalInfo ? `
        <div>
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Additional Info</p>
          <p style="margin: 0; font-size: 14px;">${safeAdditionalInfo}</p>
        </div>
        ` : ''}
      </div>
      
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #166534;">Requester</p>
        <p style="margin: 0; font-size: 14px;"><strong>${safeUserName}</strong> · ${safeUserEmail}</p>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        <a href="https://ridereadydocs.com/admin/ride-requests" style="display: inline-block; background: linear-gradient(135deg, ${primary} 0%, ${primaryLight} 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View in Admin Panel</a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #f9fafb; padding: 30px 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        © ${currentYear} Ride Ready Docs Admin Notification
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@ridereadydocs.com>", 
      to: ["info@ridereadydocs.com"],
      subject: `🎡 New ${typeLabel} Request: ${safeName}`,
      html: adminHtml,
    });

    console.log("Admin notification sent successfully:", emailResponse);

    // User confirmation email
    const userHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Request Submitted</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${success} 0%, #15803d 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 24px;">✓</span>
      </div>
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Request Submitted!</h1>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
      <p style="margin-top: 0; font-size: 16px;">Hi ${safeUserName},</p>
      
      <p style="font-size: 15px;">Thank you for submitting a request to add <strong>"${safeName}"</strong> as a new ${typeLabel.toLowerCase()} type.</p>
      
      <div style="background: #eff6ff; border-left: 4px solid ${primary}; padding: 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: ${primary};">What happens next?</p>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
          <li style="margin-bottom: 6px;">Our team will review your request within 2-3 business days</li>
          <li style="margin-bottom: 6px;">If approved, we'll add it to our database</li>
          <li style="margin-bottom: 0;">You'll receive an email when the decision is made</li>
        </ul>
      </div>
      
      <p style="font-size: 15px;">We appreciate your contribution to making Ride Ready Docs more comprehensive!</p>
      
      <p style="margin-top: 24px; margin-bottom: 0;">Best regards,<br><strong>The Ride Ready Docs Team</strong></p>
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

    const userEmailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: [requestData.userEmail],
      subject: `✓ Request Confirmed: ${safeName}`,
      html: userHtml,
    });

    console.log("User confirmation sent successfully:", userEmailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Request submitted successfully",
        adminEmail: emailResponse,
        userEmail: userEmailResponse
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-ride-type-request function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
