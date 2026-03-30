import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";
import { logEmailSend } from "../_shared/email-logger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface PublicEnquiryRequest {
  name: string;
  email: string;
  company: string;
  enquiryType: string;
  message: string;
  honeypot?: string; // Hidden field for bot detection
}

const enquiryTypeLabels: Record<string, string> = {
  general: 'General Enquiry',
  sales: 'Sales / Pricing',
  demo: 'Request a Demo',
  partnership: 'Partnership',
  other: 'Other',
};

const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Received public enquiry request");

  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Check if IP is blocked
    const clientIp = getClientIp(req);
    const blockResult = await checkIpBlocked(clientIp);
    if (blockResult.isBlocked) {
      console.log(`Blocked IP ${clientIp} attempted to access send-public-enquiry`);
      return createBlockedIpResponse(blockResult, corsHeaders);
    }

    const { name, email, company, enquiryType, message, honeypot }: PublicEnquiryRequest = await req.json();
    
    // Honeypot check - bots will fill this hidden field
    if (honeypot) {
      console.log("Bot detected via honeypot field, silently rejecting");
      // Return fake success to not alert the bot
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing enquiry from:", email, "Type:", enquiryType);

    if (!name || !email || !message) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit check - use shared persistent rate limiter
    const rateLimitKey = getClientIdentifier(req, "send-public-enquiry");
    const rateLimitResult = await checkRateLimit(rateLimitKey, "public");
    
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for ${rateLimitKey}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeCompany = escapeHtml(company);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
    const typeLabel = enquiryTypeLabels[enquiryType] || 'General Enquiry';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Website Enquiry</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">New Website Enquiry</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">${typeLabel}</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 12px 16px; background-color: #f8fafc; border-radius: 8px; margin-bottom: 16px;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">From</p>
                          <p style="margin: 0; font-size: 16px; color: #1e293b; font-weight: 500;">${safeName}</p>
                        </td>
                      </tr>
                      <tr><td style="height: 12px;"></td></tr>
                      <tr>
                        <td style="padding: 12px 16px; background-color: #f8fafc; border-radius: 8px;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Email</p>
                          <p style="margin: 0; font-size: 16px; color: #1e293b;"><a href="mailto:${safeEmail}" style="color: #2563eb; text-decoration: none;">${safeEmail}</a></p>
                        </td>
                      </tr>
                      <tr><td style="height: 12px;"></td></tr>
                      <tr>
                        <td style="padding: 12px 16px; background-color: #f8fafc; border-radius: 8px;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Company</p>
                          <p style="margin: 0; font-size: 16px; color: #1e293b;">${safeCompany}</p>
                        </td>
                      </tr>
                      <tr><td style="height: 24px;"></td></tr>
                      <tr>
                        <td>
                          <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Message</p>
                          <div style="padding: 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #f97316;">
                            <p style="margin: 0; font-size: 15px; color: #334155; line-height: 1.6;">${safeMessage}</p>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 40px; background-color: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 13px; color: #64748b;">
                      Reply directly to this email to respond to the enquiry
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    console.log("Sending notification email...");

    const emailResponse = await resend.emails.send({
      from: "Ride Ready <notifications@ridereadydocs.com>",
      to: ["info@ridereadydocs.com"],
      replyTo: email,
      subject: `[${typeLabel}] New enquiry from ${name}`,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    // Send confirmation email to the enquirer
    const confirmationHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Thank You for Getting in Touch</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; color: #334155; line-height: 1.6;">Hi ${safeName},</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; color: #334155; line-height: 1.6;">Thank you for contacting Ride Ready. We've received your message and will get back to you as soon as possible, usually within 24 hours.</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; color: #334155; line-height: 1.6;">In the meantime, feel free to explore our website or start your free trial.</p>
                    <p style="margin: 24px 0 0 0; font-size: 16px; color: #334155; line-height: 1.6;">Best regards,<br><strong>The Ride Ready Team</strong></p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 40px; background-color: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 13px; color: #64748b;">
                      <a href="https://ridereadydocs.co.uk" style="color: #2563eb; text-decoration: none;">ridereadydocs.co.uk</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: "Ride Ready <notifications@ridereadydocs.com>",
      to: [email],
      subject: "Thank you for contacting Ride Ready",
      html: confirmationHtml,
    });

    console.log("Confirmation email sent to:", email);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-public-enquiry function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
