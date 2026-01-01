import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML escape function to prevent XSS attacks
function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

interface SendRiskAssessmentRequest {
  assessmentId: string;
  rideId: string;
  rideName: string;
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  pdfBase64: string;
  pdfFileName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Get user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const {
      assessmentId,
      rideId,
      rideName,
      recipientEmail,
      recipientName = "Recipient",
      message = "",
      pdfBase64,
      pdfFileName
    }: SendRiskAssessmentRequest = await req.json();

    console.log(`Sending risk assessment ${assessmentId} to ${recipientEmail}`);

    // Get user profile for sender information
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name, controller_name, showmen_name, address")
      .eq("user_id", user.id)
      .single();

    // Get assessment details
    const { data: assessment } = await supabase
      .from("risk_assessments")
      .select("*")
      .eq("id", assessmentId)
      .eq("user_id", user.id)
      .single();

    if (!assessment) {
      throw new Error("Risk assessment not found");
    }

    const senderName = escapeHtml(profile?.company_name || profile?.controller_name || "Ride Operator");
    const safeRideName = escapeHtml(rideName);
    const safeMessage = escapeHtml(message);
    const safeRecipientName = escapeHtml(recipientName);
    const safeCompanyName = escapeHtml(profile?.company_name);
    const safeControllerName = escapeHtml(profile?.controller_name);
    const safeShowmenName = escapeHtml(profile?.showmen_name);
    const safeAddress = escapeHtml(profile?.address);
    const safeAssessorName = escapeHtml(assessment.assessor_name);
    const safePdfFileName = escapeHtml(pdfFileName);
    const safeUserEmail = escapeHtml(user.email);

    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="border-bottom: 2px solid #16a34a; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #16a34a; margin: 0 0 10px 0;">Risk Assessment</h1>
            <p style="color: #666; margin: 0;">${safeRideName}</p>
          </div>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-left: 4px solid #16a34a; margin-bottom: 20px;">
            <h2 style="color: #15803d; margin: 0 0 15px 0; font-size: 18px;">📧 From</h2>
            ${safeCompanyName ? `<p style="margin: 5px 0; font-size: 16px;"><strong>Company:</strong> ${safeCompanyName}</p>` : ''}
            ${safeControllerName ? `<p style="margin: 5px 0; font-size: 16px;"><strong>Controller:</strong> ${safeControllerName}</p>` : ''}
            ${safeShowmenName ? `<p style="margin: 5px 0; font-size: 14px; color: #666;"><strong>Showmen:</strong> ${safeShowmenName}</p>` : ''}
            ${safeAddress ? `<p style="margin: 5px 0; font-size: 14px; color: #666;"><strong>Address:</strong> ${safeAddress}</p>` : ''}
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;"><strong>Email:</strong> ${safeUserEmail}</p>
          </div>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Assessment Details</h2>
            <p><strong>Ride/Equipment:</strong> ${safeRideName}</p>
            <p><strong>Assessor:</strong> ${safeAssessorName}</p>
            <p><strong>Assessment Date:</strong> ${new Date(assessment.assessment_date).toLocaleDateString('en-GB')}</p>
            <p><strong>Status:</strong> ${assessment.overall_status === 'completed' ? '✅ Completed' : '🔄 In Progress'}</p>
          </div>

          ${safeMessage ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #333;">Message</h3>
              <p style="line-height: 1.6;">${safeMessage}</p>
            </div>
          ` : ''}

          <div style="margin-bottom: 20px;">
            <h3 style="color: #333;">Attached Document</h3>
            <div style="padding: 12px; background-color: #f1f3f4; border-radius: 4px;">
              📄 ${safePdfFileName}
            </div>
          </div>

          <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px; color: #666; font-size: 0.9em;">
            <p>This risk assessment was sent via Ride Ready Docs system.</p>
            <p>If you have any questions, please contact ${safeControllerName || 'the sender'} directly.</p>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@knutssoftware.co.uk>",
      to: [recipientEmail],
      subject: `Risk Assessment: ${safeRideName}`,
      html: htmlContent,
      attachments: [{
        filename: pdfFileName,
        content: pdfBase64,
        type: "application/pdf",
      }],
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the email send for audit trail
    await supabase
      .from("notifications")
      .insert({
        user_id: user.id,
        title: "Risk Assessment Sent",
        message: `Risk assessment for ${rideName} sent to ${recipientEmail}`,
        type: "info",
        related_table: "risk_assessments",
        related_id: assessmentId
      });

    // Also log to audit trail
    await supabase
      .from("risk_assessment_audit_log")
      .insert({
        risk_assessment_id: assessmentId,
        action: "emailed",
        changed_by: profile?.controller_name || user.email || "Unknown",
        notes: `Emailed to ${recipientEmail}`
      });

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-risk-assessment function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send risk assessment",
        details: error.toString()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
