import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendReportRequest {
  checkId: string;
  recipientEmail: string;
  recipientName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { checkId, recipientEmail, recipientName }: SendReportRequest = await req.json();

    if (!checkId || !recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Check ID and recipient email are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Fetching daily check report: ${checkId}`);

    // Fetch the inspection check with all related data
    const { data: check, error: checkError } = await supabase
      .from('inspection_checks')
      .select(`
        *,
        rides:ride_id (
          ride_name,
          manufacturer,
          serial_number,
          ride_categories (name)
        ),
        daily_check_templates:template_id (
          template_name,
          description
        ),
        inspection_check_results (
          is_checked,
          notes,
          daily_check_template_items:template_item_id (
            check_item_text,
            category,
            is_required
          )
        )
      `)
      .eq('id', checkId)
      .single();

    if (checkError || !check) {
      throw new Error('Failed to fetch check data');
    }

    // Generate HTML report
    const htmlReport = generateHTMLReport(check);

    // Send email with the report
    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `Daily Safety Check Report - ${check.rides.ride_name} - ${new Date(check.check_date).toLocaleDateString()}`,
      html: htmlReport,
    });

    console.log("Report email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-daily-check-report function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateHTMLReport(check: any): string {
  const checkedItems = check.inspection_check_results.filter((r: any) => r.is_checked);
  const totalItems = check.inspection_check_results.length;
  const passRate = Math.round((checkedItems.length / totalItems) * 100);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { background: #f8f9fa; padding: 10px; border-radius: 4px; }
        .info-label { font-weight: bold; color: #666; font-size: 12px; }
        .info-value { color: #333; font-size: 16px; }
        .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; text-transform: uppercase; font-size: 12px; }
        .status-passed { background: #28a745; color: white; }
        .status-failed { background: #dc3545; color: white; }
        .status-partial { background: #ffc107; color: #333; }
        .check-items { list-style: none; padding: 0; }
        .check-item { padding: 12px; margin-bottom: 8px; border-left: 4px solid #ddd; background: #f8f9fa; }
        .check-item.checked { border-left-color: #28a745; background: #d4edda; }
        .check-item.unchecked { border-left-color: #dc3545; background: #f8d7da; }
        .check-icon { font-weight: bold; margin-right: 10px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Daily Safety Check Report</h1>
        <p style="margin: 5px 0 0 0;">${check.rides.ride_name}</p>
      </div>

      <div class="section">
        <h2>Inspection Summary</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Ride Name</div>
            <div class="info-value">${check.rides.ride_name}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Category</div>
            <div class="info-value">${check.rides.ride_categories.name}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Inspection Date</div>
            <div class="info-value">${new Date(check.check_date).toLocaleDateString()}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Inspector</div>
            <div class="info-value">${check.inspector_name}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Status</div>
            <div class="info-value">
              <span class="status-badge status-${check.status}">${check.status.toUpperCase()}</span>
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">Completion Rate</div>
            <div class="info-value">${passRate}% (${checkedItems.length}/${totalItems})</div>
          </div>
        </div>
      </div>

      ${check.rides.manufacturer || check.rides.serial_number ? `
      <div class="section">
        <h2>Ride Details</h2>
        <div class="info-grid">
          ${check.rides.manufacturer ? `
          <div class="info-item">
            <div class="info-label">Manufacturer</div>
            <div class="info-value">${check.rides.manufacturer}</div>
          </div>
          ` : ''}
          ${check.rides.serial_number ? `
          <div class="info-item">
            <div class="info-label">Serial Number</div>
            <div class="info-value">${check.rides.serial_number}</div>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      <div class="section">
        <h2>Inspection Items</h2>
        <ul class="check-items">
          ${check.inspection_check_results.map((result: any) => `
            <li class="check-item ${result.is_checked ? 'checked' : 'unchecked'}">
              <span class="check-icon">${result.is_checked ? '✓' : '✗'}</span>
              <strong>${result.daily_check_template_items.check_item_text}</strong>
              ${result.daily_check_template_items.is_required ? ' <span style="color: #dc3545;">*</span>' : ''}
              <div style="font-size: 12px; color: #666; margin-top: 5px;">
                Category: ${result.daily_check_template_items.category}
              </div>
              ${result.notes ? `<div style="margin-top: 5px; font-style: italic;">Note: ${result.notes}</div>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>

      ${check.notes ? `
      <div class="section">
        <h2>Inspector Notes</h2>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 4px;">
          ${check.notes}
        </div>
      </div>
      ` : ''}

      <div class="footer">
        <p><strong>Ride Ready Docs</strong></p>
        <p>This is an automated report generated by Ride Ready Docs document management system.</p>
        <p>Report Generated: ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;
}

serve(handler);
