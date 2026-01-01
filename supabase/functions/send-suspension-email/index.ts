import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SuspensionEmailRequest {
  email: string;
  companyName: string | null;
  isSuspended: boolean;
  reason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, companyName, isSuspended, reason }: SuspensionEmailRequest = await req.json();

    console.log(`Sending suspension email to ${email}, suspended: ${isSuspended}`);

    const displayName = companyName || "Valued Customer";
    const appUrl = "https://ridereadydocs.com";
    
    let subject: string;
    let htmlContent: string;

    if (isSuspended) {
      subject = "Your Account Has Been Suspended - RideReadyDocs";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Account Suspended</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px;">Hello ${displayName},</p>
            <p style="font-size: 16px;">Your RideReadyDocs account has been suspended.</p>
            ${reason ? `
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #991b1b;"><strong>Reason:</strong> ${reason}</p>
              </div>
            ` : ''}
            <p style="font-size: 16px;">During the suspension period, you will not be able to access your account or any of its features.</p>
            <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Need to Appeal?</h3>
              <p style="margin-bottom: 10px;">If you believe this suspension was made in error or would like to discuss your account status, please email us at <a href="mailto:info@knutssoftware.co.uk" style="color: #dc2626;">info@knutssoftware.co.uk</a></p>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Thank you for your understanding,<br>
              <strong>The RideReadyDocs Team</strong>
            </p>
          </div>
        </body>
        </html>
      `;
    } else {
      subject = "Your Account Has Been Reactivated - RideReadyDocs";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Account Reactivated</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px;">Hello ${displayName},</p>
            <p style="font-size: 16px;">Great news! Your RideReadyDocs account has been reactivated.</p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #15803d;"><strong>✓ You can now log in and access all your features.</strong></p>
            </div>
            <p style="font-size: 16px;">All your data, documents, and settings remain intact. You can continue managing your rides and compliance documentation as before.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/auth" style="display: inline-block; background: #16a34a; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600;">Log In Now</a>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Welcome back!<br>
              <strong>The RideReadyDocs Team</strong>
            </p>
          </div>
        </body>
        </html>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "RideReadyDocs <onboarding@resend.dev>",
      to: [email],
      subject: subject,
      html: htmlContent,
    });

    console.log("Suspension email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-suspension-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
