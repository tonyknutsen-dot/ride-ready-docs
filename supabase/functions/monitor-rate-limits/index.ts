import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";
import { logEmailSend } from "../_shared/email-logger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Alert thresholds
const THRESHOLDS = {
  // Alert if single IP has more than this many rate limit entries in the check window
  entriesPerIp: 20,
  // Alert if total entries exceed this count
  totalEntries: 100,
  // Alert if any IP has been rate limited (hit the limit) more than this many times
  rateLimitHits: 5,
  // Auto-block threshold - block IPs exceeding this many requests in an hour
  autoBlockThreshold: 50,
};

// Block duration in hours based on severity
const BLOCK_DURATIONS = {
  warning: 1,    // 1 hour
  critical: 24,  // 24 hours
};

interface AbusePattern {
  type: "high_volume_ip" | "total_threshold" | "repeated_blocks";
  details: string;
  severity: "warning" | "critical";
  data: Record<string, unknown>;
}

interface BlockedIp {
  id: string;
  ip_address: string;
  reason: string;
  blocked_at: string;
  expires_at: string;
  is_active: boolean;
  blocked_by: string;
  request_count: number;
  unblock_token?: string;
}

interface BlockedIpWithToken {
  ip: string;
  unblockToken: string;
  expiresAt: string;
  requestCount: number;
  geoInfo?: GeoInfo;
}

interface GeoInfo {
  countryCode: string;
  countryName: string;
  city: string;
  region: string;
  isp: string;
}

// Function to fetch geo info for an IP
async function fetchGeoInfo(ip: string): Promise<GeoInfo | null> {
  try {
    // Skip private/local IPs
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.') || 
        ip === '127.0.0.1' || ip === 'localhost' || ip === 'unknown') {
      return {
        countryCode: 'LOCAL',
        countryName: 'Local Network',
        city: 'N/A',
        region: 'N/A',
        isp: 'Private Network',
      };
    }

    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp`);
    if (!response.ok) {
      console.log(`[GEO] Failed to fetch geo info for ${ip}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.status !== 'success') {
      console.log(`[GEO] IP lookup failed for ${ip}: ${data.message || 'Unknown error'}`);
      return null;
    }

    return {
      countryCode: data.countryCode || 'Unknown',
      countryName: data.country || 'Unknown',
      city: data.city || 'Unknown',
      region: data.regionName || 'Unknown',
      isp: data.isp || 'Unknown',
    };
  } catch (error) {
    console.error(`[GEO] Error fetching geo info for ${ip}:`, error);
    return null;
  }
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
    const action = body?.action;
    const fetchOnly = body?.fetchOnly === true;
    
    // Handle specific actions
    if (action === "stats") {
      return await handleStatsRequest(supabase);
    }
    
    if (action === "unblock") {
      return await handleUnblockRequest(supabase, body.ipAddress, body.adminId);
    }
    
    if (action === "block") {
      return await handleManualBlockRequest(supabase, body.ipAddress, body.reason, body.durationHours, body.adminId);
    }
    
    console.log("[MONITOR] Starting rate limit abuse detection...", { fetchOnly });
    
    const patterns: AbusePattern[] = [];
    const blockedIpsWithTokens: BlockedIpWithToken[] = [];
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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

    // Fetch blocked IPs
    const { data: blockedIpsData } = await supabase
      .from("blocked_ips")
      .select("*")
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("blocked_at", { ascending: false });

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
      blockedIps: blockedIpsData || [],
    };

    // If only fetching stats, return early without pattern detection
    if (fetchOnly) {
      return new Response(
        JSON.stringify({ success: true, stats }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Clean up expired blocks
    await supabase.rpc('cleanup_expired_blocks');

    // Filter to last hour for pattern detection
    const recentEntries = entries.filter((e: any) => 
      new Date(e.window_start).getTime() >= new Date(oneHourAgo).getTime()
    );

    // 1. Check for high-volume IPs (potential attackers) - use 1 hour window
    const ipCounts: Record<string, number> = {};
    for (const entry of recentEntries) {
      const ip = entry.key.split(":ip:")[1] || entry.key.split(":user:")[1] || "unknown";
      if (ip !== "unknown") {
        ipCounts[ip] = (ipCounts[ip] || 0) + entry.count;
      }
    }

    // Find high-volume IPs and auto-block if threshold exceeded
    for (const [ip, count] of Object.entries(ipCounts)) {
      const severity = count >= THRESHOLDS.entriesPerIp * 2 ? "critical" : "warning";
      
      if (count >= THRESHOLDS.entriesPerIp) {
        patterns.push({
          type: "high_volume_ip",
          severity,
          details: `IP ${ip} made ${count} requests in the last hour`,
          data: { ip, count, threshold: THRESHOLDS.entriesPerIp },
        });
      }
      
      // Auto-block IPs exceeding the auto-block threshold
      if (count >= THRESHOLDS.autoBlockThreshold) {
        const alreadyBlocked = blockedIpsData?.some((b: any) => b.ip_address === ip);
        if (!alreadyBlocked) {
          const blockDuration = BLOCK_DURATIONS[severity];
          const expiresAt = new Date(Date.now() + blockDuration * 60 * 60 * 1000).toISOString();
          
          // Generate a secure unblock token
          const unblockToken = crypto.randomUUID() + "-" + crypto.randomUUID();
          
          // Fetch geographic information for the IP
          const geoInfo = await fetchGeoInfo(ip);
          
          const { error: blockError } = await supabase
            .from("blocked_ips")
            .insert({
              ip_address: ip,
              reason: `Auto-blocked: ${count} requests in 1 hour (threshold: ${THRESHOLDS.autoBlockThreshold})`,
              expires_at: expiresAt,
              blocked_by: "auto-monitor",
              request_count: count,
              unblock_token: unblockToken,
              country_code: geoInfo?.countryCode || null,
              country_name: geoInfo?.countryName || null,
              city: geoInfo?.city || null,
              region: geoInfo?.region || null,
              isp: geoInfo?.isp || null,
            });
          
          if (!blockError) {
            blockedIpsWithTokens.push({
              ip,
              unblockToken,
              expiresAt,
              requestCount: count,
              geoInfo: geoInfo || undefined,
            });
            console.log(`[MONITOR] Auto-blocked IP ${ip} (${geoInfo?.countryCode || 'Unknown'}) for ${blockDuration} hours`);
          } else {
            console.error(`[MONITOR] Failed to block IP ${ip}:`, blockError);
          }
        }
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
        JSON.stringify({ success: true, patternsDetected: 0, alertSent: false, blockedIps: [], stats }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[MONITOR] Detected ${patterns.length} abuse patterns, auto-blocked ${blockedIpsWithTokens.length} IPs`);

    // Send alert email with quick-unblock links
    const hasCritical = patterns.some(p => p.severity === "critical");
    const alertHtml = generateAlertEmail(patterns, blockedIpsWithTokens, hasCritical, supabaseUrl);

    const { error: emailError } = await resend.emails.send({
      from: "Ride Ready Alerts <notifications@ridereadydocs.com>",
      to: ["info@ridereadydocs.com"],
      subject: `${hasCritical ? "🚨 CRITICAL" : "⚠️ Warning"}: Rate Limit Abuse Detected${blockedIpsWithTokens.length > 0 ? ` - ${blockedIpsWithTokens.length} IPs Blocked` : ""}`,
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
        blockedIps: blockedIpsWithTokens.map(b => b.ip),
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

async function handleStatsRequest(supabase: any) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const [entriesResult, blockedResult] = await Promise.all([
    supabase
      .from("rate_limit_entries")
      .select("id, key, count, window_start, created_at")
      .gte("window_start", oneDayAgo)
      .order("window_start", { ascending: false }),
    supabase
      .from("blocked_ips")
      .select("*")
      .order("blocked_at", { ascending: false })
      .limit(50),
  ]);

  const entries = entriesResult.data || [];
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
    blockedIps: blockedResult.data || [],
  };

  return new Response(
    JSON.stringify({ success: true, stats }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleUnblockRequest(supabase: any, ipAddress: string, adminId?: string) {
  if (!ipAddress) {
    return new Response(
      JSON.stringify({ success: false, error: "IP address required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { error } = await supabase
    .from("blocked_ips")
    .update({
      is_active: false,
      unblocked_at: new Date().toISOString(),
      unblocked_by: adminId || "admin",
    })
    .eq("ip_address", ipAddress)
    .eq("is_active", true);

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`[MONITOR] IP ${ipAddress} unblocked by ${adminId || "admin"}`);

  return new Response(
    JSON.stringify({ success: true, message: `IP ${ipAddress} has been unblocked` }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleManualBlockRequest(
  supabase: any, 
  ipAddress: string, 
  reason: string, 
  durationHours: number = 24,
  adminId?: string
) {
  if (!ipAddress) {
    return new Response(
      JSON.stringify({ success: false, error: "IP address required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("blocked_ips")
    .insert({
      ip_address: ipAddress,
      reason: reason || "Manually blocked by admin",
      expires_at: expiresAt,
      blocked_by: adminId || "admin",
    });

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`[MONITOR] IP ${ipAddress} manually blocked for ${durationHours} hours`);

  return new Response(
    JSON.stringify({ success: true, message: `IP ${ipAddress} blocked for ${durationHours} hours` }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function generateAlertEmail(
  patterns: AbusePattern[], 
  blockedIps: BlockedIpWithToken[], 
  hasCritical: boolean,
  supabaseUrl: string
): string {
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

  // Generate blocked IPs section with quick-unblock links
  const blockedSection = blockedIps.length > 0 ? `
    <div style="margin-top: 24px; padding: 20px; background-color: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
      <h3 style="margin: 0 0 16px 0; color: #dc2626; font-size: 16px;">🛡️ Auto-Blocked IPs</h3>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #991b1b;">
        The following IPs have been automatically blocked. Click the unblock button if this is a false positive:
      </p>
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #fee2e2;">
            <th style="padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #991b1b; border-bottom: 1px solid #fecaca;">IP Address</th>
            <th style="padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #991b1b; border-bottom: 1px solid #fecaca;">Requests</th>
            <th style="padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #991b1b; border-bottom: 1px solid #fecaca;">Expires</th>
            <th style="padding: 10px; text-align: center; font-size: 12px; text-transform: uppercase; color: #991b1b; border-bottom: 1px solid #fecaca;">Quick Action</th>
          </tr>
        </thead>
        <tbody>
          ${blockedIps.map(b => {
            const unblockUrl = `${supabaseUrl}/functions/v1/quick-unblock?token=${encodeURIComponent(b.unblockToken)}`;
            const expiresDate = new Date(b.expiresAt);
            const expiresFormatted = expiresDate.toLocaleString('en-GB', { 
              day: '2-digit', 
              month: 'short', 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            });
            return `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #fecaca;">
                  <code style="background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-size: 13px;">${b.ip}</code>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #fecaca; font-size: 14px; color: #991b1b;">
                  ${b.requestCount} req/hr
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #fecaca; font-size: 14px; color: #991b1b;">
                  ${expiresFormatted}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #fecaca; text-align: center;">
                  <a href="${unblockUrl}" 
                     style="display: inline-block; padding: 8px 16px; background-color: #22c55e; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 12px;">
                    ✓ Unblock
                  </a>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
      <p style="margin: 16px 0 0 0; font-size: 12px; color: #b91c1c;">
        ⚠️ Quick unblock links are single-use and expire with the block.
      </p>
    </div>
  ` : "";

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
            <table role="presentation" style="width: 100%; max-width: 640px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              
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
                  
                  ${blockedSection}
                  
                  <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                    <strong>Recommended Actions:</strong><br>
                    • Review the Security Dashboard for more details<br>
                    • Verify blocked IPs are legitimate threats<br>
                    • Use quick-unblock links above for false positives
                  </p>
                  
                  <div style="margin-top: 24px; text-align: center;">
                    <a href="https://ridereadydocs.com/admin/security" 
                       style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
                      Open Security Dashboard
                    </a>
                  </div>
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
