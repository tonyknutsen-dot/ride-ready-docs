import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

/**
 * GDPR Data Retention Cleanup
 * 
 * Scheduled to run daily to purge old data:
 * - blocked_ips entries older than 90 days
 * - expired rate limit entries
 * 
 * Can be triggered via cron.schedule or manual invocation
 */

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Use service role for cleanup operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const results: Record<string, number> = {};

    // 1. Clean up old blocked_ips entries (90 days)
    const { data: blockedIpsResult, error: blockedIpsError } = await supabaseAdmin
      .rpc('cleanup_old_blocked_ips');

    if (blockedIpsError) {
      console.error('Error cleaning up blocked_ips:', blockedIpsError);
    } else {
      results.blocked_ips_deleted = blockedIpsResult || 0;
      console.log(`GDPR cleanup: Deleted ${blockedIpsResult} old blocked_ips entries`);
    }

    // 2. Clean up expired IP blocks (mark as inactive)
    const { data: expiredBlocksResult, error: expiredBlocksError } = await supabaseAdmin
      .rpc('cleanup_expired_blocks');

    if (expiredBlocksError) {
      console.error('Error cleaning up expired blocks:', expiredBlocksError);
    } else {
      results.expired_blocks_cleaned = expiredBlocksResult || 0;
      console.log(`Cleaned up ${expiredBlocksResult} expired IP blocks`);
    }

    // 3. Clean up old rate limit entries (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { error: rateLimitError, count: rateLimitCount } = await supabaseAdmin
      .from('rate_limit_entries')
      .delete()
      .lt('window_start', oneHourAgo)
      .select('id', { count: 'exact', head: true });

    if (rateLimitError) {
      console.error('Error cleaning up rate_limit_entries:', rateLimitError);
    } else {
      results.rate_limit_entries_deleted = rateLimitCount || 0;
      console.log(`Deleted ${rateLimitCount} old rate_limit_entries`);
    }

    // 4. Clean up old tester sessions without end time (orphaned sessions > 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: orphanedSessionsError, count: orphanedCount } = await supabaseAdmin
      .from('tester_sessions')
      .update({ 
        session_end: new Date().toISOString(),
        duration_minutes: 0 // Mark as incomplete
      })
      .is('session_end', null)
      .lt('session_start', oneDayAgo)
      .select('id', { count: 'exact', head: true });

    if (orphanedSessionsError) {
      console.error('Error cleaning up orphaned sessions:', orphanedSessionsError);
    } else {
      results.orphaned_sessions_closed = orphanedCount || 0;
      console.log(`Closed ${orphanedCount} orphaned tester sessions`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'GDPR cleanup completed',
        results,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in gdpr-cleanup:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Cleanup failed",
        details: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);