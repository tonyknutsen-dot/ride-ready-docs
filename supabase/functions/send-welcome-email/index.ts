import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

// Brand colors
const primary = '#1e4a8f';
const primaryLight = '#2563eb';
const accent = '#f59e0b';

interface WelcomeEmailRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const { email }: WelcomeEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending welcome email to: ${email}`);

    const currentYear = new Date().getFullYear();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Ride Ready Docs</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${primary} 0%, ${primaryLight} 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="width: 60px; height: 60px; background: white; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 28px;">🎡</span>
      </div>
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Welcome to Ride Ready Docs!</h1>
      <p style="color: rgba(255, 255, 255, 0.9); margin: 12px 0 0 0; font-size: 16px;">Your journey to effortless compliance starts here</p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
      <p style="font-size: 16px; margin-top: 0;">Hello and welcome!</p>
      
      <p style="font-size: 15px;">Thank you for joining <strong>Ride Ready Docs</strong>. We're excited to help you manage your amusement equipment compliance with ease and confidence.</p>
      
      <div style="background: #eff6ff; border-left: 4px solid ${primary}; padding: 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
        <h3 style="margin: 0 0 12px 0; color: ${primary}; font-size: 16px;">🚀 Getting Started</h3>
        <ul style="margin: 0; padding-left: 20px; color: #374151;">
          <li style="margin-bottom: 8px;">Complete your profile setup</li>
          <li style="margin-bottom: 8px;">Add your first ride or equipment</li>
          <li style="margin-bottom: 8px;">Upload important documents</li>
          <li style="margin-bottom: 0;">Set up inspection schedules</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://ridereadydocs.com/overview" style="display: inline-block; background: linear-gradient(135deg, ${primary} 0%, ${primaryLight} 100%); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Go to Dashboard</a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      
      <p style="font-size: 15px; margin-bottom: 0;">Need help getting started? Our support team is here to assist you at <a href="mailto:info@ridereadydocs.com" style="color: ${primary}; text-decoration: none;">info@ridereadydocs.com</a></p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f9fafb; padding: 30px 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.8;">
        © ${currentYear} Ride Ready Docs. All rights reserved.<br>
        Professional compliance management for amusement equipment.<br><br>
        <a href="https://ridereadydocs.com" style="color: ${primary}; text-decoration: none;">ridereadydocs.com</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: [email],
      subject: "Welcome to Ride Ready Docs! 🎡",
      html,
    });

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
