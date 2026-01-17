/**
 * Shared Rate Limiting Utility for Edge Functions
 * Uses in-memory storage (resets on cold start, but effective for burst protection)
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  limit: number;
}

// In-memory rate limit storage
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configurations for different endpoint types
export const RATE_LIMITS = {
  // Public endpoints - strictest limits (unauthenticated)
  public: {
    maxRequests: 5,
    windowMs: 3600000, // 1 hour
  },
  // Authenticated endpoints - moderate limits
  authenticated: {
    maxRequests: 60,
    windowMs: 60000, // 1 minute (60 req/min)
  },
  // Email sending endpoints - prevent spam
  email: {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
  },
  // Batch operations - stricter due to resource intensity
  batch: {
    maxRequests: 5,
    windowMs: 60000, // 1 minute
  },
  // Payment endpoints - moderate but monitored
  payment: {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
  },
  // AI/Expensive operations
  expensive: {
    maxRequests: 20,
    windowMs: 60000, // 1 minute
  },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

/**
 * Clean up expired entries to prevent memory bloat
 */
const cleanupExpiredEntries = () => {
  const now = Date.now();
  if (rateLimitStore.size > 10000) {
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }
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
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || req.headers.get("cf-connecting-ip")
    || "unknown";
  
  // For authenticated requests, use user ID for more accurate limiting
  if (userId) {
    return `${functionName}:user:${userId}`;
  }
  
  return `${functionName}:ip:${ip}`;
};

/**
 * Check rate limit for a given key
 */
export const checkRateLimit = (
  key: string,
  type: RateLimitType = "authenticated"
): RateLimitResult => {
  const config = RATE_LIMITS[type];
  const now = Date.now();
  
  // Periodic cleanup
  cleanupExpiredEntries();
  
  const entry = rateLimitStore.get(key);
  
  // No existing entry or expired - allow and create new entry
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      limit: config.maxRequests,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
      limit: config.maxRequests,
    };
  }
  
  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    limit: config.maxRequests,
  };
};

/**
 * Create a rate limit error response
 */
export const createRateLimitResponse = (
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response => {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
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
