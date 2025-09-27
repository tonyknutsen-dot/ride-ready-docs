import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DocumentTypeRequest {
  documentTypeName: string;
  description?: string;
  justification?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentTypeName, description, justification }: DocumentTypeRequest = await req.json();

    if (!documentTypeName?.trim()) {
      return new Response(
        JSON.stringify({ error: "Document type name is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const emailResponse = await resend.emails.send({
      from: "RideCompliance <noreply@ridecompliance.com>",
      to: ["admin@ridecompliance.com"], // Replace with your admin email
      subject: "New Document Type Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px;">
            New Document Type Request
          </h2>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2563eb; margin-top: 0;">Requested Document Type:</h3>
            <p style="font-size: 18px; font-weight: bold; color: #333;">${documentTypeName}</p>
          </div>

          ${description ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #2563eb;">Description:</h3>
              <p style="color: #666; line-height: 1.6;">${description}</p>
            </div>
          ` : ''}

          ${justification ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #2563eb;">Justification:</h3>
              <p style="color: #666; line-height: 1.6;">${justification}</p>
            </div>
          ` : ''}

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="color: #888; font-size: 14px;">
              This request was submitted through the RideCompliance platform. 
              Please review and add this document type to the system if appropriate.
            </p>
          </div>

          <div style="margin-top: 20px; padding: 15px; background-color: #e8f4fd; border-radius: 6px;">
            <h4 style="color: #1e40af; margin-top: 0;">Action Required:</h4>
            <ol style="color: #374151; line-height: 1.6; margin: 0;">
              <li>Review the requested document type</li>
              <li>If approved, add it to the document types list in the system</li>
              <li>Consider reaching out to the user if clarification is needed</li>
            </ol>
          </div>
        </div>
      `,
    });

    console.log("Document type request email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, messageId: emailResponse.data?.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-document-type-request function:", error);
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