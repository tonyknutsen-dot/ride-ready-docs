import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestStatusEmailRequest {
  userEmail: string;
  requestType: 'ride_type' | 'document_type';
  requestName: string;
  status: 'approved' | 'rejected';
  adminNotes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, requestType, requestName, status, adminNotes }: RequestStatusEmailRequest = await req.json();

    if (!userEmail || !requestType || !requestName || !status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const isApproved = status === 'approved';
    const typeLabel = requestType === 'ride_type' ? 'Ride Type' : 'Document Type';
    const statusColor = isApproved ? '#10b981' : '#ef4444';
    const statusLabel = isApproved ? 'Approved' : 'Rejected';
    const statusEmoji = isApproved ? '✅' : '❌';

    console.log(`Sending ${status} email for ${requestType} request: ${requestName} to ${userEmail}`);

    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: [userEmail],
      subject: `${statusEmoji} Your ${typeLabel} Request has been ${statusLabel}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${typeLabel} Request Update</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin-top: 0;">Hello,</p>
            
            <p>Your request for a new ${typeLabel.toLowerCase()} has been reviewed.</p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 24px; margin-right: 10px;">${statusEmoji}</span>
                <span style="font-size: 18px; font-weight: bold; color: ${statusColor};">${statusLabel}</span>
              </div>
              
              <p style="margin: 0 0 10px 0;"><strong>Request:</strong> ${requestName}</p>
              <p style="margin: 0;"><strong>Type:</strong> ${typeLabel}</p>
            </div>
            
            ${adminNotes ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <strong style="color: #92400e;">Admin Notes:</strong>
              <p style="margin: 10px 0 0 0; color: #78350f;">${adminNotes}</p>
            </div>
            ` : ''}
            
            ${isApproved ? `
            <p style="color: #059669;">The requested ${typeLabel.toLowerCase()} will be added to the system shortly. You'll be able to use it in your rides and documents.</p>
            ` : `
            <p>If you have questions about this decision, please contact our support team through the app.</p>
            `}
            
            <p style="margin-bottom: 0;">Best regards,<br><strong>The Ride Ready Team</strong></p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} Ride Ready. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Request status email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending request status email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send email. Please try again later." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);