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

interface SendBatchDocumentsRequest {
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  documentIds: string[];
}

interface EmailBatch {
  attachments: any[];
  totalSize: number;
  documentNames: string[];
}

const handler = async (req: Request): Promise<Response> => {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const {
      recipientEmail,
      recipientName = "Recipient",
      message = "",
      documentIds
    }: SendBatchDocumentsRequest = await req.json();

    console.log(`Processing batch send for ${documentIds.length} documents to ${recipientEmail}`);

    // Get user profile for sender information
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name, controller_name, showmen_name, address, operator_type")
      .eq("user_id", user.id)
      .single();

    // Determine operator label based on operator_type
    const operatorLabel = profile?.operator_type === 'showman' ? 'Showmen' : 'Operator';

    // Get all selected documents with ride info
    const { data: documents, error: docsError } = await supabase
      .from("documents")
      .select(`
        *,
        rides:ride_id (
          ride_name,
          manufacturer
        )
      `)
      .eq("user_id", user.id)
      .in("id", documentIds);

    if (docsError) {
      console.error("Error fetching documents:", docsError);
      throw new Error("Failed to fetch documents");
    }

    console.log(`Found ${documents?.length || 0} documents to send`);

    // Download documents and prepare attachments
    const attachments = [];
    for (const doc of documents || []) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("ride-documents")
          .download(doc.file_path);

        if (!downloadError && fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          const fileExtension = doc.file_path.split('.').pop();
          const rideName = doc.rides?.ride_name || 'Global';
          const fileName = `${rideName}_${doc.document_name}.${fileExtension}`;
          
          attachments.push({
            filename: fileName,
            content: base64,
            type: doc.mime_type || "application/octet-stream",
            size: arrayBuffer.byteLength,
            documentName: doc.document_name,
            documentType: doc.document_type,
            rideName: rideName,
            expiresAt: doc.expires_at
          });
          
          console.log(`Prepared attachment: ${fileName} (${(arrayBuffer.byteLength / 1024).toFixed(1)}KB)`);
        }
      } catch (error) {
        console.error(`Failed to download document ${doc.document_name}:`, error);
      }
    }

    // Split attachments into batches if total size exceeds 10MB
    const maxEmailSize = 10 * 1024 * 1024;
    const emailBatches: EmailBatch[] = [];
    let currentBatch: EmailBatch = { attachments: [], totalSize: 0, documentNames: [] };

    for (const attachment of attachments) {
      if (currentBatch.totalSize + attachment.size > maxEmailSize && currentBatch.attachments.length > 0) {
        emailBatches.push(currentBatch);
        currentBatch = { attachments: [], totalSize: 0, documentNames: [] };
      }
      
      currentBatch.attachments.push(attachment);
      currentBatch.totalSize += attachment.size;
      currentBatch.documentNames.push(attachment.documentName);
    }
    
    if (currentBatch.attachments.length > 0) {
      emailBatches.push(currentBatch);
    }

    console.log(`Split into ${emailBatches.length} email batch(es)`);

    // Escape all user-controlled content for XSS prevention
    const safeCompanyName = escapeHtml(profile?.company_name);
    const safeControllerName = escapeHtml(profile?.controller_name);
    const safeShowmenName = escapeHtml(profile?.showmen_name);
    const safeAddress = escapeHtml(profile?.address);
    const safeUserEmail = escapeHtml(user.email);
    const safeMessage = escapeHtml(message);

    const senderName = safeCompanyName || safeControllerName || "Ride Operator";
    
    const emailResponses = [];
    let totalEmailsSent = 0;

    for (let i = 0; i < emailBatches.length; i++) {
      const batch = emailBatches[i];
      const batchNumber = i + 1;
      const totalBatches = emailBatches.length;
      
      const subject = totalBatches > 1 
        ? `Equipment Documentation Package (${batchNumber}/${totalBatches}) - ${senderName}`
        : `Equipment Documentation Package - ${senderName}`;

      const batchInfo = totalBatches > 1 
        ? `<div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
             <p style="margin: 0; color: #1565c0;"><strong>Email ${batchNumber} of ${totalBatches}</strong></p>
             <p style="margin: 5px 0 0 0; color: #1976d2; font-size: 0.9em;">This documentation has been split into multiple emails due to size limitations.</p>
           </div>`
        : '';

      // Group batch attachments by ride
      const batchDocsByRide = batch.attachments.reduce((acc, att) => {
        const key = att.rideName;
        if (!acc[key]) acc[key] = [];
        acc[key].push(att);
        return acc;
      }, {} as Record<string, typeof batch.attachments>);

      const htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 20px;">
              <h1 style="color: #007acc; margin: 0 0 10px 0;">Equipment Documentation Package</h1>
            </div>
            
            <div style="background-color: #e8f4f8; padding: 20px; border-left: 4px solid #007acc; margin-bottom: 20px;">
              <h2 style="color: #005580; margin: 0 0 15px 0; font-size: 18px;">📧 From</h2>
              ${safeCompanyName ? `<p style="margin: 5px 0; font-size: 16px;"><strong>Company:</strong> ${safeCompanyName}</p>` : ''}
              ${safeControllerName ? `<p style="margin: 5px 0; font-size: 16px;"><strong>Controller:</strong> ${safeControllerName}</p>` : ''}
              ${safeShowmenName ? `<p style="margin: 5px 0; font-size: 14px; color: #666;"><strong>${operatorLabel}:</strong> ${safeShowmenName}</p>` : ''}
              ${safeAddress ? `<p style="margin: 5px 0; font-size: 14px; color: #666;"><strong>Address:</strong> ${safeAddress}</p>` : ''}
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;"><strong>Email:</strong> ${safeUserEmail}</p>
            </div>
            
            ${batchInfo}

            ${safeMessage ? `
              <div style="margin-bottom: 20px;">
                <h3 style="color: #333;">Message</h3>
                <p style="line-height: 1.6;">${safeMessage}</p>
              </div>
            ` : ''}

            <div style="margin-bottom: 20px;">
              <h3 style="color: #333;">Attached Documents ${totalBatches > 1 ? `(Batch ${batchNumber})` : ''}</h3>
              ${Object.entries(batchDocsByRide).map(([rideName, docs]) => `
                <div style="margin-bottom: 15px;">
                  <h4 style="color: #007acc; margin: 10px 0 5px 0; font-size: 14px;">🎪 ${escapeHtml(rideName)}</h4>
                  <ul style="list-style-type: none; padding: 0; margin: 0;">
                    ${(docs as any[]).map(att => `
                      <li style="padding: 8px; margin: 4px 0; background-color: #f1f3f4; border-radius: 4px;">
                        📄 ${escapeHtml(att.documentName)} (${escapeHtml(att.documentType)})
                        ${att.expiresAt ? `<span style="color: #666; font-size: 0.9em;"> - Expires: ${escapeHtml(att.expiresAt)}</span>` : ''}
                      </li>
                    `).join('')}
                  </ul>
                </div>
              `).join('')}
              <p style="color: #666; font-size: 0.9em; margin-top: 15px;">
                ${batch.attachments.length} documents in this email
                ${totalBatches > 1 ? ` • ${attachments.length} total documents across ${totalBatches} emails` : ''}
              </p>
            </div>

            <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px; color: #666; font-size: 0.9em;">
              <p>This documentation package was sent via Ride Ready Docs system.</p>
              <p>If you have any questions about these documents, please reply to this email or contact ${safeControllerName || 'the sender'} directly.</p>
            </div>
          </body>
        </html>
      `;

      const cleanAttachments = batch.attachments.map(({ size, documentName, documentType, rideName, expiresAt, ...attachment }) => attachment);

      const emailResponse = await resend.emails.send({
        from: "Ride Ready Docs <info@ridereadydocs.com>",
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
      ? `Sent ${attachments.length} documents to ${recipientEmail} across ${totalEmailsSent} emails`
      : `Sent ${attachments.length} documents to ${recipientEmail}`;

    await supabase
      .from("notifications")
      .insert({
        user_id: user.id,
        title: "Documents Sent",
        message: notificationMessage,
        type: "info"
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
    console.error("Error in send-batch-documents function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to send documents. Please try again later."
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
