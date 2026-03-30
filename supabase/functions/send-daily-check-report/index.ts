import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { Resend } from "npm:resend@4.0.0";
import { brandColors, emailStyles, logoSvg, escapeHtml } from "../_shared/email-template.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { logEmailSend } from "../_shared/email-logger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

interface SendReportRequest {
  checkId?: string;
  checkIds?: string[];
  recipientEmail: string;
  recipientName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { checkId, checkIds, recipientEmail, recipientName }: SendReportRequest = await req.json();

    if ((!checkId && !checkIds) || !recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Check ID(s) and recipient email are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const idsToFetch = checkIds || [checkId!];
    console.log(`Fetching ${idsToFetch.length} daily check report(s)`);

    // Fetch the inspection checks with all related data
    const { data: checks, error: checkError } = await supabase
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
      .in('id', idsToFetch)
      .order('check_date', { ascending: false });

    if (checkError || !checks || checks.length === 0) {
      throw new Error('Failed to fetch check data');
    }

    // Generate HTML report (single or bulk)
    const htmlReport = checks.length === 1 
      ? generateHTMLReport(checks[0])
      : generateBulkHTMLReport(checks);

    const subject = checks.length === 1
      ? `Daily Safety Check Report - ${checks[0].rides.ride_name} - ${new Date(checks[0].check_date).toLocaleDateString('en-GB')}`
      : `Daily Safety Check Reports - ${checks.length} Reports`;

    // Send email with the report
    const emailResponse = await resend.emails.send({
      from: "Ride Ready Docs <info@ridereadydocs.com>",
      to: [recipientEmail],
      subject,
      html: htmlReport,
    });

    console.log("Report email sent successfully:", emailResponse);

    await logEmailSend({
      template_name: 'daily-check-report',
      recipient_email: recipientEmail,
      subject,
      status: 'sent',
      message_id: emailResponse?.data?.id || undefined,
    });

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-daily-check-report function:", error);

    await logEmailSend({
      template_name: 'daily-check-report',
      recipient_email: 'unknown',
      status: 'failed',
      error_message: error.message,
    }).catch(() => {});

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

function generateHTMLReport(check: any): string {
  const checkedItems = check.inspection_check_results.filter((r: any) => r.is_checked);
  const totalItems = check.inspection_check_results.length;
  const passRate = Math.round((checkedItems.length / totalItems) * 100);
  const currentYear = new Date().getFullYear();

  const safeRideName = escapeHtml(check.rides.ride_name);
  const safeCategoryName = escapeHtml(check.rides.ride_categories?.name);
  const safeInspectorName = escapeHtml(check.inspector_name);
  const safeManufacturer = escapeHtml(check.rides.manufacturer);
  const safeSerialNumber = escapeHtml(check.rides.serial_number);
  const safeNotes = escapeHtml(check.notes);

  const statusColor = check.status === 'passed' ? brandColors.success : check.status === 'failed' ? brandColors.danger : brandColors.accent;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Safety Check Report</title>
</head>
<body style="${emailStyles.body}">
  <div style="${emailStyles.container}">
    <div style="${emailStyles.header}">
      <div style="margin-bottom: 16px;">${logoSvg}</div>
      <h1 style="${emailStyles.headerTitle}">Daily Safety Check Report</h1>
      <p style="${emailStyles.headerSubtitle}">${safeRideName}</p>
    </div>
    
    <div style="${emailStyles.content}">
      <div style="${emailStyles.card}">
        <p style="${emailStyles.label}">INSPECTION SUMMARY</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid ${brandColors.border}; width: 40%;"><strong>Ride Name</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid ${brandColors.border};">${safeRideName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Category</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid ${brandColors.border};">${safeCategoryName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Inspection Date</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid ${brandColors.border};">${new Date(check.check_date).toLocaleDateString('en-GB')}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Inspector</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid ${brandColors.border};">${safeInspectorName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid ${brandColors.border};"><strong>Status</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid ${brandColors.border};">
              <span style="display: inline-block; padding: 4px 16px; border-radius: 20px; font-weight: 600; font-size: 12px; text-transform: uppercase; background: ${statusColor}; color: white;">
                ${check.status}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0;"><strong>Completion Rate</strong></td>
            <td style="padding: 10px 0;">${passRate}% (${checkedItems.length}/${totalItems} items)</td>
          </tr>
        </table>
      </div>

      ${safeManufacturer || safeSerialNumber ? `
      <div style="${emailStyles.card}">
        <p style="${emailStyles.label}">RIDE DETAILS</p>
        <table style="width: 100%; border-collapse: collapse;">
          ${safeManufacturer ? `
          <tr>
            <td style="padding: 8px 0; width: 40%;"><strong>Manufacturer</strong></td>
            <td style="padding: 8px 0;">${safeManufacturer}</td>
          </tr>
          ` : ''}
          ${safeSerialNumber ? `
          <tr>
            <td style="padding: 8px 0;"><strong>Serial Number</strong></td>
            <td style="padding: 8px 0;">${safeSerialNumber}</td>
          </tr>
          ` : ''}
        </table>
      </div>
      ` : ''}

      <div style="margin: 24px 0;">
        <p style="${emailStyles.label}">INSPECTION ITEMS</p>
        ${check.inspection_check_results.map((result: any) => `
          <div style="padding: 12px 16px; margin: 8px 0; border-radius: 6px; border-left: 4px solid ${result.is_checked ? brandColors.success : brandColors.danger}; background: ${result.is_checked ? '#f0fdf4' : '#fef2f2'};">
            <span style="font-weight: bold; margin-right: 10px; color: ${result.is_checked ? brandColors.success : brandColors.danger};">${result.is_checked ? '✓' : '✗'}</span>
            <strong>${escapeHtml(result.daily_check_template_items.check_item_text)}</strong>
            ${result.daily_check_template_items.is_required ? `<span style="color: ${brandColors.danger};"> *</span>` : ''}
            <div style="font-size: 12px; color: ${brandColors.textLight}; margin-top: 4px;">
              Category: ${escapeHtml(result.daily_check_template_items.category)}
            </div>
            ${result.notes ? `<div style="margin-top: 8px; font-style: italic; color: ${brandColors.text};">Note: ${escapeHtml(result.notes)}</div>` : ''}
          </div>
        `).join('')}
      </div>

      ${safeNotes ? `
      <div style="${emailStyles.warningBox}">
        <p style="${emailStyles.label}">INSPECTOR NOTES</p>
        <p style="${emailStyles.value}; line-height: 1.8;">${safeNotes}</p>
      </div>
      ` : ''}

      <hr style="${emailStyles.divider}">
      <p style="color: ${brandColors.textLight}; font-size: 12px; text-align: center;">
        Report Generated: ${new Date().toLocaleString('en-GB')}
      </p>
    </div>
    
    <div style="${emailStyles.footer}">
      <p style="${emailStyles.footerText}">
        © ${currentYear} Ride Ready Docs. All rights reserved.<br>
        Professional compliance management for amusement equipment.<br><br>
        <a href="https://ridereadydocs.com" style="${emailStyles.footerLink}">ridereadydocs.com</a> · 
        <a href="mailto:info@ridereadydocs.com" style="${emailStyles.footerLink}">info@ridereadydocs.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function generateBulkHTMLReport(checks: any[]): string {
  const totalChecks = checks.length;
  const passedChecks = checks.filter(c => c.status === 'passed').length;
  const failedChecks = checks.filter(c => c.status === 'failed').length;
  const currentYear = new Date().getFullYear();

  let reportsHTML = '';
  
  checks.forEach((check, index) => {
    const checkedItems = check.inspection_check_results.filter((r: any) => r.is_checked);
    const totalItems = check.inspection_check_results.length;
    const passRate = Math.round((checkedItems.length / totalItems) * 100);
    const statusColor = check.status === 'passed' ? brandColors.success : check.status === 'failed' ? brandColors.danger : brandColors.accent;

    reportsHTML += `
      <div style="margin-bottom: 32px; border: 1px solid ${brandColors.border}; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.primaryLight} 100%); color: white; padding: 20px;">
          <h2 style="margin: 0; font-size: 18px;">Report ${index + 1} of ${totalChecks}</h2>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">${escapeHtml(check.rides.ride_name)}</p>
        </div>

        <div style="padding: 20px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div style="background: ${brandColors.background}; padding: 12px; border-radius: 6px;">
              <div style="font-size: 11px; font-weight: 600; color: ${brandColors.textLight}; margin-bottom: 4px;">INSPECTION DATE</div>
              <div style="font-size: 14px;">${new Date(check.check_date).toLocaleDateString('en-GB')}</div>
            </div>
            <div style="background: ${brandColors.background}; padding: 12px; border-radius: 6px;">
              <div style="font-size: 11px; font-weight: 600; color: ${brandColors.textLight}; margin-bottom: 4px;">INSPECTOR</div>
              <div style="font-size: 14px;">${escapeHtml(check.inspector_name)}</div>
            </div>
            <div style="background: ${brandColors.background}; padding: 12px; border-radius: 6px;">
              <div style="font-size: 11px; font-weight: 600; color: ${brandColors.textLight}; margin-bottom: 4px;">STATUS</div>
              <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: ${statusColor}; color: white;">
                ${check.status}
              </span>
            </div>
            <div style="background: ${brandColors.background}; padding: 12px; border-radius: 6px;">
              <div style="font-size: 11px; font-weight: 600; color: ${brandColors.textLight}; margin-bottom: 4px;">COMPLETION</div>
              <div style="font-size: 14px;">${passRate}% (${checkedItems.length}/${totalItems})</div>
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 600; color: ${brandColors.primary}; margin-bottom: 10px;">KEY CHECKS SUMMARY</div>
            ${check.inspection_check_results.slice(0, 5).map((result: any) => `
              <div style="padding: 8px 12px; margin: 4px 0; background: ${result.is_checked ? '#f0fdf4' : '#fef2f2'}; border-radius: 4px; border-left: 3px solid ${result.is_checked ? brandColors.success : brandColors.danger}; font-size: 13px;">
                <span style="font-weight: bold; margin-right: 8px;">${result.is_checked ? '✓' : '✗'}</span>
                ${escapeHtml(result.daily_check_template_items.check_item_text)}
              </div>
            `).join('')}
            ${check.inspection_check_results.length > 5 ? `
              <div style="padding: 8px 12px; background: ${brandColors.background}; border-radius: 4px; font-size: 12px; text-align: center; color: ${brandColors.textLight};">
                + ${check.inspection_check_results.length - 5} more items
              </div>
            ` : ''}
          </div>

          ${check.notes ? `
          <div style="background: #fffbeb; padding: 12px; border-radius: 4px; border-left: 4px solid ${brandColors.accent};">
            <div style="font-size: 11px; font-weight: 600; color: #92400e; margin-bottom: 4px;">INSPECTOR NOTES</div>
            <div style="color: #92400e; font-size: 13px;">${escapeHtml(check.notes)}</div>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Safety Check Reports</title>
</head>
<body style="${emailStyles.body}">
  <div style="${emailStyles.container}">
    <div style="${emailStyles.header}">
      <div style="margin-bottom: 16px;">${logoSvg}</div>
      <h1 style="${emailStyles.headerTitle}">Daily Safety Check Reports</h1>
      <p style="${emailStyles.headerSubtitle}">Bulk Report Package - ${totalChecks} Reports</p>
    </div>
    
    <div style="${emailStyles.content}">
      <div style="${emailStyles.card}; text-align: center;">
        <p style="${emailStyles.label}">SUMMARY</p>
        <div style="display: flex; justify-content: center; gap: 24px; margin-top: 16px;">
          <div>
            <div style="font-size: 36px; font-weight: bold; color: ${brandColors.primary};">${totalChecks}</div>
            <div style="font-size: 12px; color: ${brandColors.textLight}; text-transform: uppercase;">Total Reports</div>
          </div>
          <div>
            <div style="font-size: 36px; font-weight: bold; color: ${brandColors.success};">${passedChecks}</div>
            <div style="font-size: 12px; color: ${brandColors.textLight}; text-transform: uppercase;">Passed</div>
          </div>
          <div>
            <div style="font-size: 36px; font-weight: bold; color: ${brandColors.danger};">${failedChecks}</div>
            <div style="font-size: 12px; color: ${brandColors.textLight}; text-transform: uppercase;">Failed</div>
          </div>
        </div>
      </div>

      ${reportsHTML}

      <hr style="${emailStyles.divider}">
      <p style="color: ${brandColors.textLight}; font-size: 12px; text-align: center;">
        Report Generated: ${new Date().toLocaleString('en-GB')}
      </p>
    </div>
    
    <div style="${emailStyles.footer}">
      <p style="${emailStyles.footerText}">
        © ${currentYear} Ride Ready Docs. All rights reserved.<br>
        Professional compliance management for amusement equipment.<br><br>
        <a href="https://ridereadydocs.com" style="${emailStyles.footerLink}">ridereadydocs.com</a> · 
        <a href="mailto:info@ridereadydocs.com" style="${emailStyles.footerLink}">info@ridereadydocs.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

serve(handler);
