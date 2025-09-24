import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendDocumentsRequest {
  rideId: string;
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  includeInsurance: boolean;
  documentIds: string[];
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
      rideId,
      recipientEmail,
      recipientName = "Council/Authority",
      message = "",
      includeInsurance,
      documentIds
    }: SendDocumentsRequest = await req.json();

    // Get ride information
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("ride_name, manufacturer, serial_number, year_manufactured")
      .eq("id", rideId)
      .eq("user_id", user.id)
      .single();

    if (rideError || !ride) {
      throw new Error("Ride not found");
    }

    // Get user profile for sender information
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name, controller_name, showmen_name")
      .eq("user_id", user.id)
      .single();

    // Get ride-specific documents
    const { data: rideDocuments, error: rideDocsError } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .eq("ride_id", rideId)
      .in("id", documentIds);

    if (rideDocsError) {
      throw new Error("Failed to fetch ride documents");
    }

    // Get insurance documents if requested
    let insuranceDocuments: any[] = [];
    if (includeInsurance) {
      const { data: insurance } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_global", true)
        .ilike("document_type", "%insurance%");
      
      insuranceDocuments = insurance || [];
    }

    const allDocuments = [...(rideDocuments || []), ...insuranceDocuments];

    // Download documents from storage and prepare attachments
    const attachments = [];
    for (const doc of allDocuments) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("ride-documents")
          .download(doc.file_path);

        if (!downloadError && fileData) {
          // Convert blob to base64
          const arrayBuffer = await fileData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          // Create proper filename with ride name prefix
          const fileExtension = doc.file_path.split('.').pop();
          const fileName = `${ride.ride_name}_${doc.document_name}.${fileExtension}`;
          
          attachments.push({
            filename: fileName,
            content: base64,
            type: doc.mime_type || "application/octet-stream",
          });
        }
      } catch (error) {
        console.error(`Failed to download document ${doc.document_name}:`, error);
      }
    }

    // Create email content
    const senderName = profile?.company_name || profile?.controller_name || "Ride Operator";
    const rideInfo = `${ride.ride_name}${ride.manufacturer ? ` (${ride.manufacturer})` : ''}${ride.serial_number ? ` - S/N: ${ride.serial_number}` : ''}`;

    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #007acc; margin: 0;">Ride Documentation Package</h1>
            <p style="color: #666; margin: 5px 0 0 0;">From: ${senderName}</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Ride Information</h2>
            <p><strong>Ride Name:</strong> ${ride.ride_name}</p>
            ${ride.manufacturer ? `<p><strong>Manufacturer:</strong> ${ride.manufacturer}</p>` : ''}
            ${ride.serial_number ? `<p><strong>Serial Number:</strong> ${ride.serial_number}</p>` : ''}
            ${ride.year_manufactured ? `<p><strong>Year Manufactured:</strong> ${ride.year_manufactured}</p>` : ''}
          </div>

          ${message ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #333;">Message</h3>
              <p style="line-height: 1.6;">${message}</p>
            </div>
          ` : ''}

          <div style="margin-bottom: 20px;">
            <h3 style="color: #333;">Attached Documents</h3>
            <ul style="list-style-type: none; padding: 0;">
              ${allDocuments.map(doc => `
                <li style="padding: 8px; margin: 4px 0; background-color: #f1f3f4; border-radius: 4px;">
                  📄 ${doc.document_name} (${doc.document_type})
                  ${doc.expires_at ? `<span style="color: #666; font-size: 0.9em;"> - Expires: ${doc.expires_at}</span>` : ''}
                </li>
              `).join('')}
            </ul>
            <p style="color: #666; font-size: 0.9em;">Total: ${attachments.length} documents attached</p>
          </div>

          <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px; color: #666; font-size: 0.9em;">
            <p>This documentation package was sent via Ride Ready Docs system.</p>
            <p>If you have any questions about these documents, please reply to this email.</p>
            ${profile?.company_name ? `<p><strong>Company:</strong> ${profile.company_name}</p>` : ''}
            ${profile?.controller_name ? `<p><strong>Controller:</strong> ${profile.controller_name}</p>` : ''}
          </div>
        </body>
      </html>
    `;

    // Send email with attachments
    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <noreply@resend.dev>",
      to: [recipientEmail],
      subject: `Ride Documentation: ${rideInfo}`,
      html: htmlContent,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the email send for audit trail
    await supabase
      .from("notifications")
      .insert({
        user_id: user.id,
        title: "Documents Sent",
        message: `Sent ${attachments.length} documents for ${ride.ride_name} to ${recipientEmail}`,
        type: "info",
        related_table: "rides",
        related_id: rideId
      });

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      documentsCount: attachments.length 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-ride-documents function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send documents",
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