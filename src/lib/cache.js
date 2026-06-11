import Redis from 'ioredis';

let redisClient = null;

export function getRedisClient() {
  if (!redisClient) {
    try {
      redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379/0', {
        db: parseInt(process.env.REDIS_CACHE_DB || '1', 10),
        lazyConnect: true,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
      });

      redisClient.on('error', (err) => {
        console.warn('[cache] Redis connection error:', err.message);
      });
    } catch (e) {
      console.warn('[cache] Redis unavailable:', e.message);
      return null;
    }
  }
  return redisClient;
}

export async function getCached(key) {
  try {
    const client = getRedisClient();
    if (!client) return null;

    const raw = await client.get(key);
    if (raw === null) return null;

    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[cache] getCached("${key}") failed:`, e.message);
    return null;
  }
}

export async function setCached(key, value, ttlSeconds) {
  try {
    const client = getRedisClient();
    if (!client) return;

    const serialized = JSON.stringify(value);
    if (ttlSeconds != null && ttlSeconds > 0) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
  } catch (e) {
    console.warn(`[cache] setCached("${key}") failed:`, e.message);
  }
}

export async function delCached(key) {
  try {
    const client = getRedisClient();
    if (!client) return;

    await client.del(key);
  } catch (e) {
    console.warn(`[cache] delCached("${key}") failed:`, e.message);
  }
}

export async function getCachedOrFetch(key, ttlSeconds, fetchFn) {
  try {
    const cached = await getCached(key);
    if (cached !== null) return cached;
  } catch (_) {
  }

  try {
    const value = await fetchFn();
    await setCached(key, value, ttlSeconds);
    return value;
  } catch (e) {
    console.warn(`[cache] getCachedOrFetch("${key}") fetchFn failed:`, e.message);
    throw e;
  }
}
