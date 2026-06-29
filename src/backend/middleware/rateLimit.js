/**
 * Rate limiting middleware for backend SSE proxy.
 * Uses in-memory token bucket with optional Redis backing for distributed rate limiting.
 */

import { getRedisClient } from '../../lib/cache.js';

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 1000; // 1000 requests per minute

// In-memory token bucket (fallback when Redis unavailable)
const tokenBuckets = new Map();

/**
 * Get remaining quota for IP/key
 * Redis format: `ratelimit:{key}` = count (expires in window)
 */
async function getRemainingQuota(key, maxRequests, windowMs) {
  const redisClient = getRedisClient();
  
  if (redisClient) {
    try {
      const current = await redisClient.incr(`ratelimit:${key}`);
      if (current === 1) {
        // First request in window, set expiry
        await redisClient.expire(`ratelimit:${key}`, Math.ceil(windowMs / 1000));
      }
      return Math.max(0, maxRequests - current);
    } catch (e) {
      console.warn(`[rateLimit] Redis error for key ${key}:`, e.message);
      // Fallback to in-memory
    }
  }

  // In-memory fallback
  const now = Date.now();
  if (!tokenBuckets.has(key)) {
    tokenBuckets.set(key, { count: 0, resetAt: now + windowMs });
  }

  const bucket = tokenBuckets.get(key);
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count++;
  return Math.max(0, maxRequests - bucket.count);
}

/**
 * Rate limit middleware factory
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @param {function} keyFn - Function to extract key from request (default: IP)
 */
export function createRateLimitMiddleware(
  maxRequests = DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
  keyFn = (req) => req.ip || req.connection.remoteAddress || 'unknown'
) {
  return async (req, res, next) => {
    try {
      const key = keyFn(req);
      const remaining = await getRemainingQuota(key, maxRequests, windowMs);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

      if (remaining < 0) {
        console.warn(`[rateLimit] Rate limit exceeded for ${key}: ${maxRequests} req/${windowMs}ms`);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded: ${maxRequests} requests per ${Math.round(windowMs / 1000)}s`,
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      next();
    } catch (err) {
      console.error('[rateLimit] Middleware error:', err.message);
      // On error, allow request through (fail-open for safety)
      next();
    }
  };
}

/**
 * Cleanup old buckets (run periodically to prevent memory leak)
 */
export function cleanupTokenBuckets() {
  const now = Date.now();
  for (const [key, bucket] of tokenBuckets.entries()) {
    if (now > bucket.resetAt + 60000) { // Keep buckets 1 min after expiry
      tokenBuckets.delete(key);
    }
  }
}

// Cleanup every 5 minutes
if (typeof process !== 'undefined') {
  setInterval(cleanupTokenBuckets, 5 * 60 * 1000).unref?.();
}

export default createRateLimitMiddleware;
