import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Alert thresholds
const THRESHOLDS = {
  // Alert if single IP has more than this many rate limit entries in the check window
  entriesPerIp: 20,
  // Alert if total entries exceed this count
  totalEntries: 100,
  // Alert if any IP has been rate limited (hit the limit) more than this many times
  rateLimitHits: 5,
};

interface AbusePattern {
  type: "high_volume_ip" | "total_threshold" | "repeated_blocks";
  details: string;
  severity: "warning" | "critical";
  data: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const fetchOnly = body?.fetchOnly === true;
    
    console.log("[MONITOR] Starting rate limit abuse detection...", { fetchOnly });
    
    const patterns: AbusePattern[] = [];
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Fetch all entries from last 24 hours for stats
    const { data: allEntries, error: entriesError } = await supabase
      .from("rate_limit_entries")
      .select("id, key, count, window_start, created_at")
      .gte("window_start", oneDayAgo)
      .order("window_start", { ascending: false });

    if (entriesError) {
      console.error("[MONITOR] Error fetching entries:", entriesError);
    }

    // Build stats for dashboard
    const entries = allEntries || [];
    const sourceMap: Record<string, number> = {};
    let totalRequests = 0;

    entries.forEach((entry: any) => {
      sourceMap[entry.key] = (sourceMap[entry.key] || 0) + entry.count;
      totalRequests += entry.count;
    });

    const topSources = Object.entries(sourceMap)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const stats = {
      totalEntries: entries.length,
      totalRequests,
      uniqueSources: Object.keys(sourceMap).length,
      topSources,
      recentActivity: entries.slice(0, 20),
    };

    // If only fetching stats, return early without pattern detection
    if (fetchOnly) {
      return new Response(
        JSON.stringify({ success: true, stats }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Filter to last hour for pattern detection
    const recentEntries = entries.filter((e: any) => 
      new Date(e.window_start).getTime() >= new Date(oneHourAgo).getTime()
    );

    // 1. Check for high-volume IPs (potential attackers) - use 1 hour window
    const ipCounts: Record<string, number> = {};
    for (const entry of recentEntries) {
      const ip = entry.key.split(":ip:")[1] || entry.key.split(":user:")[1] || "unknown";
      ipCounts[ip] = (ipCounts[ip] || 0) + entry.count;
    }

    // Find high-volume IPs
    for (const [ip, count] of Object.entries(ipCounts)) {
      if (count >= THRESHOLDS.entriesPerIp) {
        patterns.push({
          type: "high_volume_ip",
          severity: count >= THRESHOLDS.entriesPerIp * 2 ? "critical" : "warning",
          details: `IP ${ip} made ${count} requests in the last hour`,
          data: { ip, count, threshold: THRESHOLDS.entriesPerIp },
        });
      }
    }

    // 2. Check total entries threshold (last hour)
    const hourlyTotal = recentEntries.reduce((sum: number, e: any) => sum + e.count, 0);
    if (hourlyTotal >= THRESHOLDS.totalEntries) {
      patterns.push({
        type: "total_threshold",
        severity: hourlyTotal >= THRESHOLDS.totalEntries * 2 ? "critical" : "warning",
        details: `Total rate limit entries (${hourlyTotal}) exceeded threshold (${THRESHOLDS.totalEntries})`,
        data: { totalEntries: hourlyTotal, threshold: THRESHOLDS.totalEntries },
      });
    }

    console.log(`[MONITOR] Analyzed ${recentEntries.length} entries, ${Object.keys(ipCounts).length} unique sources`);

    // 3. Check for repeated rate limit blocks (IPs that keep hitting limits)
    const highCountEntries = recentEntries.filter((e: any) => e.count >= 5);
    if (highCountEntries.length >= THRESHOLDS.rateLimitHits) {
      const blockedKeys = [...new Set(highCountEntries.map((e: any) => e.key))];
      patterns.push({
        type: "repeated_blocks",
        severity: blockedKeys.length >= THRESHOLDS.rateLimitHits * 2 ? "critical" : "warning",
        details: `${blockedKeys.length} sources repeatedly hitting rate limits`,
        data: { blockedKeys: blockedKeys.slice(0, 10), count: blockedKeys.length },
      });
    }

    // If no patterns detected, just log and return with stats
    if (patterns.length === 0) {
      console.log("[MONITOR] No abuse patterns detected");
      return new Response(
        JSON.stringify({ success: true, patternsDetected: 0, alertSent: false, stats }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[MONITOR] Detected ${patterns.length} abuse patterns`);

    // Send alert email
    const hasCritical = patterns.some(p => p.severity === "critical");
    const alertHtml = generateAlertEmail(patterns, hasCritical);

    const { error: emailError } = await resend.emails.send({
      from: "Ride Ready Alerts <notifications@ridereadydocs.com>",
      to: ["info@ridereadydocs.com"],
      subject: `${hasCritical ? "🚨 CRITICAL" : "⚠️ Warning"}: Rate Limit Abuse Detected`,
      html: alertHtml,
    });

    if (emailError) {
      console.error("[MONITOR] Failed to send alert email:", emailError);
    } else {
      console.log("[MONITOR] Alert email sent successfully");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        patternsDetected: patterns.length,
        patterns,
        alertSent: !emailError,
        stats,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[MONITOR] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

function generateAlertEmail(patterns: AbusePattern[], hasCritical: boolean): string {
  const severityColor = hasCritical ? "#dc2626" : "#f59e0b";
  const severityText = hasCritical ? "Critical Security Alert" : "Security Warning";

  const patternRows = patterns.map(p => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background-color: ${p.severity === 'critical' ? '#fef2f2' : '#fffbeb'}; color: ${p.severity === 'critical' ? '#dc2626' : '#d97706'};">
          ${p.severity.toUpperCase()}
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${p.type.replace(/_/g, ' ').toUpperCase()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${p.details}</td>
    </tr>
  `).join("");

  return `
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
              
              <!-- Header -->
              <tr>
                <td style="background-color: ${severityColor}; padding: 30px 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${severityText}</h1>
                  <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Rate Limit Monitoring System</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 30px 40px;">
                  <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                    The following suspicious patterns have been detected in your rate limiting system:
                  </p>
                  
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                      <tr style="background-color: #f9fafb;">
                        <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Severity</th>
                        <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Type</th>
                        <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${patternRows}
                    </tbody>
                  </table>
                  
                  <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                    <strong>Recommended Actions:</strong><br>
                    • Review the Supabase logs for more details<br>
                    • Consider temporarily blocking suspicious IPs<br>
                    • Check if this correlates with any known attack patterns
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 40px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    Automated alert from Ride Ready Security Monitoring<br>
                    Generated at ${new Date().toISOString()}
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
}
