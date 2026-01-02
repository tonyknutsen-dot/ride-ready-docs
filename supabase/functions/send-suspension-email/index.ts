import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand colors
const primary = '#1e4a8f';
const primaryLight = '#2563eb';
const success = '#16a34a';
const danger = '#dc2626';

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

interface SuspensionEmailRequest {
  email: string;
  companyName: string | null;
  isSuspended: boolean;
  reason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, companyName, isSuspended, reason }: SuspensionEmailRequest = await req.json();

    console.log(`Sending suspension email to ${email}, suspended: ${isSuspended}`);

    const displayName = escapeHtml(companyName) || "Valued Customer";
    const currentYear = new Date().getFullYear();
    
    let subject: string;
    let html: string;

    if (isSuspended) {
      subject = "Account Suspended - Ride Ready Docs";
      html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Suspended</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${danger} 0%, #991b1b 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 24px;">⚠️</span>
      </div>
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Account Suspended</h1>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
      <p style="margin-top: 0; font-size: 16px;">Hello ${displayName},</p>
      
      <p style="font-size: 15px;">Your Ride Ready Docs account has been suspended.</p>
      
      ${reason ? `
      <div style="background: #fef2f2; border-left: 4px solid ${danger}; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #991b1b;">Reason</p>
        <p style="margin: 0; font-size: 15px; color: #7f1d1d;">${escapeHtml(reason)}</p>
      </div>
      ` : ''}
      
      <p style="font-size: 15px;">During the suspension period, you will not be able to access your account or any of its features.</p>
      
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 16px;">Need to Appeal?</h3>
        <p style="margin: 0; font-size: 15px;">If you believe this suspension was made in error or would like to discuss your account status, please email us at <a href="mailto:info@ridereadydocs.com" style="color: ${primary}; text-decoration: none; font-weight: 600;">info@ridereadydocs.com</a></p>
      </div>
      
      <p style="margin-top: 24px; margin-bottom: 0;">Thank you for your understanding,<br><strong>The Ride Ready Docs Team</strong></p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f9fafb; padding: 30px 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        © ${currentYear} Ride Ready Docs. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
      `;
    } else {
      subject = "Account Reactivated - Ride Ready Docs";
      html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Reactivated</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${success} 0%, #15803d 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 24px;">✓</span>
      </div>
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Account Reactivated</h1>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none;">
      <p style="margin-top: 0; font-size: 16px;">Hello ${displayName},</p>
      
      <p style="font-size: 15px;">Great news! Your Ride Ready Docs account has been reactivated.</p>
      
      <div style="background: #f0fdf4; border-left: 4px solid ${success}; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
        <p style="margin: 0; font-size: 15px; color: #166534; font-weight: 600;">✓ You can now log in and access all your features.</p>
      </div>
      
      <p style="font-size: 15px;">All your data, documents, and settings remain intact. You can continue managing your rides and compliance documentation as before.</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://ridereadydocs.com/auth" style="display: inline-block; background: linear-gradient(135deg, ${success} 0%, #15803d 100%); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Log In Now</a>
      </div>
      
      <p style="margin-top: 24px; margin-bottom: 0;">Welcome back!<br><strong>The Ride Ready Docs Team</strong></p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f9fafb; padding: 30px 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        © ${currentYear} Ride Ready Docs. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: [email],
      subject,
      html,
    });

    console.log("Suspension email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-suspension-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
