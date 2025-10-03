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

interface EmailBatch {
  attachments: any[];
  totalSize: number;
  documentNames: string[];
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
      .select("company_name, controller_name, showmen_name, address")
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
            size: arrayBuffer.byteLength,
            documentName: doc.document_name,
            documentType: doc.document_type,
            expiresAt: doc.expires_at
          });
        }
      } catch (error) {
        console.error(`Failed to download document ${doc.document_name}:`, error);
      }
    }

    // Split attachments into batches if total size exceeds 10MB
    const maxEmailSize = 10 * 1024 * 1024; // 10MB in bytes
    const emailBatches: EmailBatch[] = [];
    let currentBatch: EmailBatch = { attachments: [], totalSize: 0, documentNames: [] };

    for (const attachment of attachments) {
      // If adding this attachment would exceed limit, start new batch
      if (currentBatch.totalSize + attachment.size > maxEmailSize && currentBatch.attachments.length > 0) {
        emailBatches.push(currentBatch);
        currentBatch = { attachments: [], totalSize: 0, documentNames: [] };
      }
      
      currentBatch.attachments.push(attachment);
      currentBatch.totalSize += attachment.size;
      currentBatch.documentNames.push(attachment.documentName);
    }
    
    // Add the last batch if it has attachments
    if (currentBatch.attachments.length > 0) {
      emailBatches.push(currentBatch);
    }

    // Create and send emails (split if necessary)
    const senderName = profile?.company_name || profile?.controller_name || "Ride Operator";
    const rideInfo = `${ride.ride_name}${ride.manufacturer ? ` (${ride.manufacturer})` : ''}${ride.serial_number ? ` - S/N: ${ride.serial_number}` : ''}`;
    
    const emailResponses = [];
    let totalEmailsSent = 0;

    for (let i = 0; i < emailBatches.length; i++) {
      const batch = emailBatches[i];
      const batchNumber = i + 1;
      const totalBatches = emailBatches.length;
      
      const subject = totalBatches > 1 
        ? `Ride Documentation (${batchNumber}/${totalBatches}): ${rideInfo}`
        : `Ride Documentation: ${rideInfo}`;

      const batchInfo = totalBatches > 1 
        ? `<div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
             <p style="margin: 0; color: #1565c0;"><strong>Email ${batchNumber} of ${totalBatches}</strong></p>
             <p style="margin: 5px 0 0 0; color: #1976d2; font-size: 0.9em;">This documentation has been split into multiple emails due to size limitations.</p>
           </div>`
        : '';

      const htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 20px;">
              <h1 style="color: #007acc; margin: 0 0 10px 0;">Ride Documentation Package</h1>
            </div>
            
            <div style="background-color: #e8f4f8; padding: 20px; border-left: 4px solid #007acc; margin-bottom: 20px;">
              <h2 style="color: #005580; margin: 0 0 15px 0; font-size: 18px;">📧 From</h2>
              ${profile?.company_name ? `<p style="margin: 5px 0; font-size: 16px;"><strong>Company:</strong> ${profile.company_name}</p>` : ''}
              ${profile?.controller_name ? `<p style="margin: 5px 0; font-size: 16px;"><strong>Controller:</strong> ${profile.controller_name}</p>` : ''}
              ${profile?.showmen_name ? `<p style="margin: 5px 0; font-size: 14px; color: #666;"><strong>Showmen:</strong> ${profile.showmen_name}</p>` : ''}
              ${profile?.address ? `<p style="margin: 5px 0; font-size: 14px; color: #666;"><strong>Address:</strong> ${profile.address}</p>` : ''}
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;"><strong>Email:</strong> ${user.email}</p>
            </div>
            
            ${batchInfo}
            
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
              <h3 style="color: #333;">Attached Documents ${totalBatches > 1 ? `(Batch ${batchNumber})` : ''}</h3>
              <ul style="list-style-type: none; padding: 0;">
                ${batch.attachments.map(attachment => `
                  <li style="padding: 8px; margin: 4px 0; background-color: #f1f3f4; border-radius: 4px;">
                    📄 ${attachment.documentName} (${attachment.documentType})
                    ${attachment.expiresAt ? `<span style="color: #666; font-size: 0.9em;"> - Expires: ${attachment.expiresAt}</span>` : ''}
                  </li>
                `).join('')}
              </ul>
              <p style="color: #666; font-size: 0.9em;">
                ${batch.attachments.length} documents in this email
                ${totalBatches > 1 ? ` • ${attachments.length} total documents across ${totalBatches} emails` : ''}
              </p>
            </div>

            <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px; color: #666; font-size: 0.9em;">
              <p>This documentation package was sent via Ride Ready Docs system.</p>
              <p>If you have any questions about these documents, please reply to this email or contact ${profile?.controller_name || 'the sender'} directly.</p>
            </div>
          </body>
        </html>
      `;

      // Prepare attachments for this batch (remove size info for Resend)
      const cleanAttachments = batch.attachments.map(({ size, documentName, documentType, expiresAt, ...attachment }) => attachment);

      const emailResponse = await resend.emails.send({
        from: "Ride Ready Docs <noreply@resend.dev>",
        to: [recipientEmail],
        subject,
        html: htmlContent,
        attachments: cleanAttachments.length > 0 ? cleanAttachments : undefined,
      });

      emailResponses.push(emailResponse);
      totalEmailsSent++;
      
      console.log(`Email batch ${batchNumber}/${totalBatches} sent successfully:`, emailResponse);
    }

    // Log the email send for audit trail
    const notificationMessage = totalEmailsSent > 1 
      ? `Sent ${attachments.length} documents for ${ride.ride_name} to ${recipientEmail} across ${totalEmailsSent} emails`
      : `Sent ${attachments.length} documents for ${ride.ride_name} to ${recipientEmail}`;

    await supabase
      .from("notifications")
      .insert({
        user_id: user.id,
        title: "Documents Sent",
        message: notificationMessage,
        type: "info",
        related_table: "rides",
        related_id: rideId
      });

    return new Response(JSON.stringify({ 
      success: true, 
      emailIds: emailResponses.map(r => r.data?.id).filter(Boolean),
      documentsCount: attachments.length,
      emailsSent: totalEmailsSent,
      wasSplit: totalEmailsSent > 1
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