import { RateLimiterMemory } from "rate-limiter-flexible";

export function createLimiters(opts) {
  const ipConfig = {
    points: opts.ip.points,
    duration: opts.ip.duration,
    blockDuration: opts.ip.blockDuration,
  };

  const apiKeyConfig = opts.apiKey
    ? {
        points: opts.apiKey.points,
        duration: opts.apiKey.duration,
        blockDuration: opts.apiKey.blockDuration,
      }
    : undefined;

  return {
    ip: new RateLimiterMemory(ipConfig),
    apiKey: apiKeyConfig ? new RateLimiterMemory(apiKeyConfig) : undefined,
  };
}

export const limiters = {
  chat: createLimiters({
    ip: { points: 30, duration: 60, blockDuration: 300 },
    apiKey: { points: 300, duration: 60 },
  }),
  embeddings: createLimiters({
    ip: { points: 100, duration: 60 },
  }),
  images: createLimiters({
    ip: { points: 10, duration: 60 },
  }),
  audio: createLimiters({
    ip: { points: 20, duration: 60 },
  }),
  models: createLimiters({
    ip: { points: 200, duration: 60 },
  }),
};

export function isInternal(request) {
  const ip = getClientIp(request);
  if (!ip) return false;
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "::ffff:127.0.0.1";
}

export function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip) return ip;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  // Fallback to connection remote address if available
  const socket = request.socket || request._socket;
  if (socket?.remoteAddress) return socket.remoteAddress;
  // No identifiable IP — treat as unknown (rate-limit separately, don't bypass)
  return null;
}

export async function checkRateLimit({ request, ipLimiter, keyLimiter, ip, apiKey }) {
  const clientIp = ip || getClientIp(request) || "unknown";
  if (isInternal(request)) return null;

  try {
    const ipResult = await ipLimiter.consume(clientIp);
    const headers = {
      "X-RateLimit-Limit": String(ipLimiter.points),
      "X-RateLimit-Remaining": String(ipResult.remainingPoints),
      "X-RateLimit-Reset": String(Math.ceil((Date.now() + ipResult.msBeforeNext) / 1000)),
    };

    if (apiKey && keyLimiter) {
      try {
        const keyResult = await keyLimiter.consume(apiKey);
        headers["X-RateLimit-Limit"] = String(keyLimiter.points);
        headers["X-RateLimit-Remaining"] = String(keyResult.remainingPoints);
        headers["X-RateLimit-Reset"] = String(Math.ceil((Date.now() + keyResult.msBeforeNext) / 1000));
      } catch (keyError) {
        headers["Retry-After"] = String(Math.ceil(keyError.msBeforeNext / 1000));
        return new Response(
          JSON.stringify({
            error: {
              message: "Rate limit exceeded for API key. Please slow down your requests.",
              type: "rate_limit_error",
              param: null,
              code: "rate_limit_exceeded",
            },
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
          }
        );
      }
    }

    return null;
  } catch (ipError) {
    return new Response(
      JSON.stringify({
        error: {
          message: "Rate limit exceeded. Please slow down your requests.",
          type: "rate_limit_error",
          param: null,
          code: "rate_limit_exceeded",
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(ipError.msBeforeNext / 1000)),
          "X-RateLimit-Limit": String(ipLimiter.points),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((Date.now() + ipError.msBeforeNext) / 1000)),
        },
      }
    );
  }
}
