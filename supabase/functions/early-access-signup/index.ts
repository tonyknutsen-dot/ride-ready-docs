import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@4.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { logEmailSend } from "../_shared/email-logger.ts";
import { 
  checkRateLimit, 
  getClientIdentifier, 
  createRateLimitResponse,
  getSecureHeaders 
} from "../_shared/rate-limit.ts";
import { 
  generateEmailWrapper, 
  emailStyles, 
  escapeHtml 
} from "../_shared/email-template.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface SignupRequest {
  email: string;
  name?: string;
  honeypot?: string; // Bot detection field
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Rate limiting - use public type (strict limits for unauthenticated)
    const rateLimitKey = getClientIdentifier(req, "early-access-signup");
    const rateLimitResult = await checkRateLimit(rateLimitKey, "public");
    
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for early-access-signup: ${rateLimitKey}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { email, name, honeypot }: SignupRequest = await req.json();

    // Bot detection - honeypot field should be empty
    if (honeypot) {
      console.warn("Honeypot triggered - likely bot submission");
      // Return success to not reveal detection
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: getSecureHeaders(corsHeaders, rateLimitResult) }
      );
    }

    // Validate email format
    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: getSecureHeaders(corsHeaders, rateLimitResult) }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address" }),
        { status: 400, headers: getSecureHeaders(corsHeaders, rateLimitResult) }
      );
    }

    // Email length validation
    if (trimmedEmail.length > 255) {
      return new Response(
        JSON.stringify({ error: "Email address is too long" }),
        { status: 400, headers: getSecureHeaders(corsHeaders, rateLimitResult) }
      );
    }

    // Name validation (optional, max 100 chars)
    const trimmedName = name?.trim().slice(0, 100) || null;

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for existing signup
    const { data: existing } = await supabase
      .from("early_access_signups")
      .select("id")
      .eq("email", trimmedEmail)
      .single();

    if (existing) {
      // Already signed up - return friendly message
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "You're already on the list! We'll be in touch soon." 
        }),
        { status: 200, headers: getSecureHeaders(corsHeaders, rateLimitResult) }
      );
    }

    // Insert new signup
    const { error: insertError } = await supabase
      .from("early_access_signups")
      .insert({
        email: trimmedEmail,
        name: trimmedName,
        source: "coming_soon",
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      
      // Handle unique constraint violation (race condition)
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "You're already on the list! We'll be in touch soon." 
          }),
          { status: 200, headers: getSecureHeaders(corsHeaders, rateLimitResult) }
        );
      }
      
      throw insertError;
    }

    // Get total signup count for admin notification
    const { count } = await supabase
      .from("early_access_signups")
      .select("*", { count: "exact", head: true });

    // Send confirmation email to user
    const userEmailContent = `
      <p style="font-size: 16px; margin-bottom: 20px;">
        ${trimmedName ? `Hi ${escapeHtml(trimmedName)},` : 'Hi there,'}
      </p>
      
      <p style="font-size: 15px; margin-bottom: 20px;">
        Thanks for signing up for early access to <strong>Ride Ready Docs</strong>! 
        We're building the complete documentation management platform for amusement ride operators.
      </p>
      
      <div style="${emailStyles.successBox}">
        <p style="margin: 0; font-size: 14px;">
          <strong>You're on the list!</strong><br>
          We'll notify you as soon as we launch. You'll be among the first to try the platform.
        </p>
      </div>
      
      <p style="font-size: 15px; margin-bottom: 20px;">
        In the meantime, here's what you can look forward to:
      </p>
      
      <ul style="font-size: 14px; padding-left: 20px; margin-bottom: 20px;">
        <li style="margin-bottom: 8px;"><strong>Secure Document Storage</strong> – Enterprise-grade security for your compliance documents</li>
        <li style="margin-bottom: 8px;"><strong>Smart Organisation</strong> – Keep all certificates and records in one place</li>
        <li style="margin-bottom: 8px;"><strong>Automated Reminders</strong> – Never miss an expiry or inspection date</li>
      </ul>
      
      <hr style="${emailStyles.divider}">
      
      <p style="font-size: 13px; color: #6b7280;">
        If you didn't sign up for this, you can safely ignore this email.
      </p>
    `;

    const userEmailHtml = generateEmailWrapper(
      "You're on the Early Access List!",
      "Thanks for your interest in Ride Ready Docs",
      userEmailContent
    );

    // Send email to user
    try {
      await resend.emails.send({
        from: "Ride Ready Docs <noreply@ridereadydocs.co.uk>",
        to: [trimmedEmail],
        subject: "You're on the Ride Ready Docs Early Access List!",
        html: userEmailHtml,
      });
      console.log(`Confirmation email sent to ${trimmedEmail}`);
    } catch (emailError) {
      console.error("Failed to send user confirmation email:", emailError);
      // Don't fail the request - signup is still recorded
    }

    // Send notification email to admin
    const adminEmailContent = `
      <p style="font-size: 16px; margin-bottom: 20px;">
        <strong>New early access signup!</strong>
      </p>
      
      <div style="${emailStyles.card}">
        <p style="${emailStyles.label}">Email</p>
        <p style="${emailStyles.value}">${escapeHtml(trimmedEmail)}</p>
        
        ${trimmedName ? `
          <p style="${emailStyles.label}; margin-top: 16px;">Name</p>
          <p style="${emailStyles.value}">${escapeHtml(trimmedName)}</p>
        ` : ''}
        
        <p style="${emailStyles.label}; margin-top: 16px;">Signed Up At</p>
        <p style="${emailStyles.value}">${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>
      </div>
      
      <div style="${emailStyles.infoBox}">
        <p style="margin: 0; font-size: 14px;">
          <strong>Total Signups:</strong> ${count || 1}
        </p>
      </div>
    `;

    const adminEmailHtml = generateEmailWrapper(
      "New Early Access Signup",
      "Someone wants to try Ride Ready Docs",
      adminEmailContent
    );

    // Send email to admin
    try {
      await resend.emails.send({
        from: "Ride Ready Docs <noreply@ridereadydocs.co.uk>",
        to: ["info@ridereadydocs.com"],
        subject: `New Early Access Signup: ${trimmedEmail}`,
        html: adminEmailHtml,
      });
      console.log("Admin notification sent");
    } catch (emailError) {
      console.error("Failed to send admin notification:", emailError);
      // Don't fail the request
    }

    console.log(`Early access signup recorded: ${trimmedEmail}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Thanks for signing up! Check your inbox for a confirmation email." 
      }),
      { status: 200, headers: getSecureHeaders(corsHeaders, rateLimitResult) }
    );

  } catch (error) {
    console.error("Early access signup error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
