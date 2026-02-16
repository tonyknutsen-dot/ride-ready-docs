import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * Scheduled cleanup function for rate limit entries
 * Runs daily to remove expired entries and prevent table bloat
 */
serve(async (req: Request) => {
  // Only allow POST requests (from cron)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log("[CLEANUP] Starting rate limit cleanup...");

    // Delete entries older than 2 hours (well past any rate limit window)
    const cutoffTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data, error, count } = await supabase
      .from("rate_limit_entries")
      .delete()
      .lt("window_start", cutoffTime)
      .select("id");

    if (error) {
      console.error("[CLEANUP] Error deleting old entries:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const deletedCount = data?.length || 0;
    console.log(`[CLEANUP] Deleted ${deletedCount} expired rate limit entries`);

    // Get current table size for monitoring
    const { count: remainingCount } = await supabase
      .from("rate_limit_entries")
      .select("id", { count: "exact", head: true });

    console.log(`[CLEANUP] Remaining entries: ${remainingCount || 0}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: deletedCount,
        remaining: remainingCount || 0,
        cutoffTime
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[CLEANUP] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
