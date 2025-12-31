/**
 * Simple In-Memory Rate Limiter
 *
 * WARNING: This is in-memory only and resets on server restart.
 * For production, use Redis:
 *   - Install ioredis
 *   - Replace Map with Redis INCR + EXPIRE
 *   - Add sliding window algorithm for smoother limits
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

// In-memory store (will reset on restart)
const rateLimits = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits.entries()) {
    // Remove entries older than 24 hours
    if (now - entry.windowStart > 24 * 60 * 60 * 1000) {
      rateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check and update rate limit for a key
 *
 * @param key - Unique identifier (e.g., "sms:lead123:daily")
 * @param maxCount - Maximum allowed requests in the window
 * @param windowMs - Time window in milliseconds
 * @returns Whether the request is allowed and remaining count
 */
export function checkRateLimit(
  key: string,
  maxCount: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimits.get(key);

  // First request or window expired
  if (!entry || now - entry.windowStart >= windowMs) {
    rateLimits.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: maxCount - 1,
    };
  }

  // Within window - check limit
  if (entry.count >= maxCount) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  // Increment and allow
  entry.count += 1;
  return {
    allowed: true,
    remaining: maxCount - entry.count,
  };
}

/**
 * Check if a lead can receive another text today
 */
export function canSendTextToLead(
  leadId: string,
  maxPerDay: number = 3
): RateLimitResult {
  return checkRateLimit(
    `sms:lead:${leadId}:daily`,
    maxPerDay,
    24 * 60 * 60 * 1000 // 24 hours
  );
}

/**
 * Check if a lead can receive another follow-up this week
 */
export function canSendFollowupToLead(
  leadId: string,
  maxPerWeek: number = 3
): RateLimitResult {
  return checkRateLimit(
    `followup:lead:${leadId}:weekly`,
    maxPerWeek,
    7 * 24 * 60 * 60 * 1000 // 7 days
  );
}

/**
 * Get human-readable retry time
 */
export function formatRetryAfter(ms: number): string {
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours < 1) {
    const minutes = Math.ceil(ms / (60 * 1000));
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * Reset rate limit for a key (useful for testing)
 */
export function resetRateLimit(key: string): void {
  rateLimits.delete(key);
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimits.clear();
}
