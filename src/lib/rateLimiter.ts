/**
 * Rate Limiter with Redis Support
 *
 * Uses Redis when available for persistence across restarts.
 * Falls back to in-memory storage for development.
 */

import { getRedisInstance, isUsingRedis } from '../storage/redis.js';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

// In-memory fallback store
const memoryLimits = new Map<string, RateLimitEntry>();

// Redis key prefix
const RATE_LIMIT_PREFIX = 'ratelimit:';

// Cleanup old in-memory entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryLimits.entries()) {
    // Remove entries older than 24 hours
    if (now - entry.windowStart > 24 * 60 * 60 * 1000) {
      memoryLimits.delete(key);
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
export async function checkRateLimit(
  key: string,
  maxCount: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedisInstance();

  if (isUsingRedis() && redis) {
    return checkRateLimitRedis(redis, key, maxCount, windowMs);
  }

  return checkRateLimitMemory(key, maxCount, windowMs);
}

/**
 * Redis-based rate limiting using INCR with TTL
 */
async function checkRateLimitRedis(
  redis: NonNullable<ReturnType<typeof getRedisInstance>>,
  key: string,
  maxCount: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redisKey = `${RATE_LIMIT_PREFIX}${key}`;
  const ttlSeconds = Math.ceil(windowMs / 1000);

  try {
    // Use MULTI/EXEC for atomic operation
    const pipeline = redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.ttl(redisKey);

    const results = await pipeline.exec();
    if (!results) {
      // Redis error, fall back to memory
      return checkRateLimitMemory(key, maxCount, windowMs);
    }

    const [[incrErr, count], [ttlErr, ttl]] = results as [[Error | null, number], [Error | null, number]];

    if (incrErr) {
      return checkRateLimitMemory(key, maxCount, windowMs);
    }

    // Set TTL on first request (when TTL is -1)
    if (ttl === -1) {
      await redis.expire(redisKey, ttlSeconds);
    }

    if (count > maxCount) {
      // Calculate retry time based on remaining TTL
      const currentTtl = ttl === -1 ? ttlSeconds : ttl;
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: currentTtl * 1000,
      };
    }

    return {
      allowed: true,
      remaining: maxCount - count,
    };
  } catch (error) {
    console.error('Redis rate limit error, falling back to memory:', error);
    return checkRateLimitMemory(key, maxCount, windowMs);
  }
}

/**
 * In-memory rate limiting (fallback)
 */
function checkRateLimitMemory(
  key: string,
  maxCount: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = memoryLimits.get(key);

  // First request or window expired
  if (!entry || now - entry.windowStart >= windowMs) {
    memoryLimits.set(key, { count: 1, windowStart: now });
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
export async function canSendTextToLead(
  leadId: string,
  maxPerDay: number = 3
): Promise<RateLimitResult> {
  return checkRateLimit(
    `sms:lead:${leadId}:daily`,
    maxPerDay,
    24 * 60 * 60 * 1000 // 24 hours
  );
}

/**
 * Check if a lead can receive another follow-up this week
 */
export async function canSendFollowupToLead(
  leadId: string,
  maxPerWeek: number = 3
): Promise<RateLimitResult> {
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
export async function resetRateLimit(key: string): Promise<void> {
  const redis = getRedisInstance();

  if (isUsingRedis() && redis) {
    await redis.del(`${RATE_LIMIT_PREFIX}${key}`);
  }

  memoryLimits.delete(key);
}

/**
 * Clear all rate limits (useful for testing)
 */
export async function clearAllRateLimits(): Promise<void> {
  const redis = getRedisInstance();

  if (isUsingRedis() && redis) {
    const keys = await redis.keys(`${RATE_LIMIT_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  memoryLimits.clear();
}
