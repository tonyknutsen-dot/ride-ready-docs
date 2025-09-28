import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  // Handle CORS preflight requests
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

    // Validate required fields
    if (!requestData.name || !requestData.type || !requestData.description || !requestData.userEmail) {
      throw new Error('Missing required fields');
    }

    // Generate email content
    const typeLabel = requestData.type === 'ride' ? 'Fairground Ride' : 
                     requestData.type === 'stall' ? 'Food/Game Stall' : 'Generator/Equipment';
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
          New ${typeLabel} Type Request
        </h2>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Request Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280; width: 150px;">Name:</td>
              <td style="padding: 8px 0; color: #111827;">${requestData.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Type:</td>
              <td style="padding: 8px 0; color: #111827;">${typeLabel}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Description:</td>
              <td style="padding: 8px 0; color: #111827;">${requestData.description}</td>
            </tr>
            ${requestData.manufacturer ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Manufacturer:</td>
              <td style="padding: 8px 0; color: #111827;">${requestData.manufacturer}</td>
            </tr>
            ` : ''}
            ${requestData.additionalInfo ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Additional Info:</td>
              <td style="padding: 8px 0; color: #111827;">${requestData.additionalInfo}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Requester Information</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280; width: 100px;">Name:</td>
              <td style="padding: 8px 0; color: #111827;">${requestData.userName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Email:</td>
              <td style="padding: 8px 0; color: #111827;">${requestData.userEmail}</td>
            </tr>
          </table>
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <h4 style="margin: 0 0 10px 0; color: #1e40af;">Next Steps</h4>
          <p style="margin: 0; color: #374151;">
            Review this request and if appropriate, add "${requestData.name}" to the ride_categories table in the database.
          </p>
        </div>
      </div>
    `;

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "Showmen App <noreply@lovable.app>", 
      to: ["admin@lovable.app"], // Replace with your admin email
      subject: `New ${typeLabel} Request: ${requestData.name}`,
      html: htmlContent,
    });

    console.log("Admin notification sent successfully:", emailResponse);

    // Send confirmation email to user
    const userConfirmationHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Request Submitted Successfully!</h2>
        
        <p>Hi ${requestData.userName},</p>
        
        <p>Thank you for submitting a request to add <strong>"${requestData.name}"</strong> as a new ${typeLabel.toLowerCase()} type to our database.</p>
        
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>What happens next?</strong></p>
          <ul style="margin: 10px 0;">
            <li>Our team will review your request within 2-3 business days</li>
            <li>If approved, we'll add it to our database</li>
            <li>You'll be able to select it when adding new rides or stalls</li>
          </ul>
        </div>
        
        <p>We appreciate your contribution to making our app more comprehensive for all showmen!</p>
        
        <p>Best regards,<br>The Showmen App Team</p>
      </div>
    `;

    const userEmailResponse = await resend.emails.send({
      from: "Showmen App <noreply@lovable.app>",
      to: [requestData.userEmail],
      subject: `Request Confirmed: ${requestData.name}`,
      html: userConfirmationHtml,
    });

    console.log("User confirmation sent successfully:", userEmailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Request submitted successfully",
        adminEmail: emailResponse,
        userEmail: userEmailResponse
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-ride-type-request function:", error);
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