/**
 * Shared Rate Limiting Utility for Edge Functions
 * Uses Supabase for persistent storage across isolates
 * 
 * SECURITY: Critical endpoints (email, payment) fail CLOSED on errors
 * to prevent abuse during database outages. Non-critical endpoints
 * fail open to maintain availability.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  limit: number;
  failedClosed?: boolean; // Indicates if request was denied due to error
}

// Rate limit configurations for different endpoint types
export const RATE_LIMITS = {
  // Public endpoints - strictest limits (unauthenticated)
  public: {
    maxRequests: 5,
    windowMs: 3600000, // 1 hour
    failClosed: false, // Less critical, maintain availability
  },
  // Authenticated endpoints - moderate limits
  authenticated: {
    maxRequests: 60,
    windowMs: 60000, // 1 minute (60 req/min)
    failClosed: false, // Less critical, maintain availability
  },
  // Email sending endpoints - prevent spam (CRITICAL)
  email: {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
    failClosed: true, // CRITICAL: Fail closed to prevent email spam
  },
  // Batch operations - stricter due to resource intensity
  batch: {
    maxRequests: 5,
    windowMs: 60000, // 1 minute
    failClosed: true, // CRITICAL: Fail closed to prevent resource abuse
  },
  // Payment endpoints - moderate but monitored (CRITICAL)
  payment: {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
    failClosed: true, // CRITICAL: Fail closed to prevent payment abuse
  },
  // AI/Expensive operations
  expensive: {
    maxRequests: 20,
    windowMs: 60000, // 1 minute
    failClosed: true, // CRITICAL: Fail closed to prevent expensive operation abuse
  },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

/**
 * Extract IP address from request
 */
export const getClientIp = (req: Request): string => {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || req.headers.get("cf-connecting-ip")
    || "unknown";
};

/**
 * Extract client identifier from request
 * Uses a combination of IP, user ID, and function name for granular limiting
 */
export const getClientIdentifier = (
  req: Request,
  functionName: string,
  userId?: string
): string => {
  const ip = getClientIp(req);
  
  // For authenticated requests, use user ID for more accurate limiting
  if (userId) {
    return `${functionName}:user:${userId}`;
  }
  
  return `${functionName}:ip:${ip}`;
};

interface BlockedIpResult {
  isBlocked: boolean;
  reason?: string;
  expiresAt?: string;
}

/**
 * Check if an IP address is blocked
 */
export const checkIpBlocked = async (ip: string): Promise<BlockedIpResult> => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase.rpc('is_ip_blocked', { p_ip: ip });
    
    if (error) {
      console.error("IP block check error:", error);
      return { isBlocked: false };
    }
    
    if (data && data.length > 0 && data[0].is_blocked) {
      return {
        isBlocked: true,
        reason: data[0].reason,
        expiresAt: data[0].expires_at,
      };
    }
    
    return { isBlocked: false };
  } catch (err) {
    console.error("IP block check error:", err);
    return { isBlocked: false };
  }
};

/**
 * Create a blocked IP response
 */
export const createBlockedIpResponse = (
  result: BlockedIpResult,
  corsHeaders: Record<string, string>
): Response => {
  return new Response(
    JSON.stringify({
      error: "Your IP has been temporarily blocked due to suspicious activity.",
      reason: result.reason,
      expiresAt: result.expiresAt,
    }),
    {
      status: 403,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
};

/**
 * Check rate limit using Supabase for persistent storage
 * Uses an upsert pattern with atomic operations
 * 
 * SECURITY BEHAVIOR:
 * - Critical endpoints (email, payment, batch, expensive) FAIL CLOSED on errors
 * - Non-critical endpoints (public, authenticated) FAIL OPEN on errors
 */
export const checkRateLimit = async (
  key: string,
  type: RateLimitType = "authenticated"
): Promise<RateLimitResult> => {
  const config = RATE_LIMITS[type];
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Call database function for atomic rate limit check
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_max_requests: config.maxRequests,
      p_window_ms: config.windowMs
    });
    
    if (error) {
      console.error("Rate limit check error:", error);
      
      // SECURITY: Critical endpoints fail CLOSED on database errors
      if (config.failClosed) {
        console.warn(`SECURITY: Rate limit failed CLOSED for ${type} endpoint due to database error`);
        return {
          allowed: false,
          remaining: 0,
          retryAfter: 60, // Ask client to retry in 60 seconds
          limit: config.maxRequests,
          failedClosed: true,
        };
      }
      
      // Non-critical endpoints fail OPEN to maintain availability
      console.warn(`Rate limit failed OPEN for ${type} endpoint due to database error`);
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        limit: config.maxRequests,
      };
    }
    
    const result = data as { allowed: boolean; current_count: number; retry_after_ms: number };
    
    if (!result.allowed) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil(result.retry_after_ms / 1000),
        limit: config.maxRequests,
      };
    }
    
    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - result.current_count),
      limit: config.maxRequests,
    };
  } catch (err) {
    console.error("Rate limit error:", err);
    
    // SECURITY: Critical endpoints fail CLOSED on any errors
    if (config.failClosed) {
      console.warn(`SECURITY: Rate limit failed CLOSED for ${type} endpoint due to exception`);
      return {
        allowed: false,
        remaining: 0,
        retryAfter: 60, // Ask client to retry in 60 seconds
        limit: config.maxRequests,
        failedClosed: true,
      };
    }
    
    // Non-critical endpoints fail OPEN to maintain availability
    console.warn(`Rate limit failed OPEN for ${type} endpoint due to exception`);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      limit: config.maxRequests,
    };
  }
};

/**
 * Create a rate limit error response
 */
export const createRateLimitResponse = (
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response => {
  // Provide more helpful error message if rate limiting failed closed
  const errorMessage = result.failedClosed
    ? "Service temporarily unavailable. Please try again in a moment."
    : "Too many requests. Please try again later.";
  
  return new Response(
    JSON.stringify({
      error: errorMessage,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
};

/**
 * Add rate limit headers to successful responses
 */
export const getRateLimitHeaders = (result: RateLimitResult): Record<string, string> => {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };
};

/**
 * Security headers to add to all responses
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

/**
 * Combine all headers for a response
 */
export const getSecureHeaders = (
  corsHeaders: Record<string, string>,
  rateLimitResult?: RateLimitResult
): Record<string, string> => {
  return {
    ...corsHeaders,
    ...SECURITY_HEADERS,
    ...(rateLimitResult ? getRateLimitHeaders(rateLimitResult) : {}),
    "Content-Type": "application/json",
  };
};
