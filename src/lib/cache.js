import Redis from 'ioredis';

let redisClient = null;
let redisCluster = null;

function createRedisConfig() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || process.env.REDIS_CACHE_DB || '1', 10),
    
    // Connection optimization
    family: 4,
    connectTimeout: 10000,
    lazyConnect: true,
    
    // Command settings
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    
    // Keep-alive settings
    keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE || '30000', 10),
    
    // Performance optimizations
    enableReadyCheck: false,
    enableOfflineQueue: true,
    maxLoadingTimeout: 5000,
    
    // Exponential backoff retry strategy (100ms, 200ms, 500ms, 1000ms, max 3 retries)
    retryStrategy(times) {
      const maxRetries = parseInt(process.env.REDIS_MAX_RETRIES || '3', 10);
      if (times > maxRetries) return null;
      
      const delays = [100, 200, 500, 1000];
      const delay = delays[Math.min(times - 1, delays.length - 1)];
      return delay;
    },
    
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'];
      return targetErrors.some(targetError => err.message.includes(targetError));
    },
  };
}

export function getRedisClient() {
  // Check if Redis Cluster mode is requested
  if (process.env.REDIS_CLUSTER_NODES) {
    if (!redisCluster) {
      try {
        const nodes = process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
          const [host, port] = node.trim().split(':');
          return { host, port: parseInt(port, 10) };
        });
        
        const clusterOptions = {
          redisOptions: {
            ...createRedisConfig(),
            scaleRead: process.env.READ_FROM_REPLICAS === 'true' ? 'slave' : undefined,
          },
          slotsRefreshTimeout: 5000,
          nodesAliveTimeout: 20000,
        };
        
        redisCluster = new Redis.Cluster(nodes, clusterOptions);
        
        redisCluster.on('error', (err) => {
          console.warn('[cache] Redis Cluster connection error:', err.message);
        });
        
        redisCluster.on('connect', () => {
          console.log('[cache] Redis Cluster connected');
        });
        
        redisCluster.on('close', () => {
          console.warn('[cache] Redis Cluster connection closed');
        });
        
        redisCluster.on('reconnecting', () => {
          console.log('[cache] Redis Cluster reconnecting...');
        });
      } catch (e) {
        console.warn('[cache] Redis Cluster unavailable:', e.message);
        return null;
      }
    }
    return redisCluster;
  }
  
  // Single Redis instance mode
  if (!redisClient) {
    try {
      const config = createRedisConfig();
      
      if (process.env.REDIS_URL) {
        redisClient = new Redis(process.env.REDIS_URL, config);
      } else {
        redisClient = new Redis(config);
      }

      redisClient.on('error', (err) => {
        console.warn('[cache] Redis connection error:', err.message);
      });

      redisClient.on('connect', () => {
        console.log('[cache] Redis connected');
      });

      redisClient.on('close', () => {
        console.warn('[cache] Redis connection closed');
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

const inFlightRequests = new Map();

const INFLIGHT_MAX_AGE_MS = 5 * 60 * 1000;
const inflightCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of inFlightRequests) {
    if (entry.startTime && now - entry.startTime > INFLIGHT_MAX_AGE_MS) {
      inFlightRequests.delete(key);
    }
  }
}, 60 * 1000);
if (inflightCleanup.unref) inflightCleanup.unref();

export async function getCachedOrFetch(key, ttlSeconds, fetchFn) {
  const cached = await getCached(key);
  if (cached !== null) return cached;

  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key).promise;
  }

  const entry = { startTime: Date.now() };
  
  const promise = (async () => {
    try {
      const value = await fetchFn();
      await setCached(key, value, ttlSeconds);
      return value;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  entry.promise = promise;
  inFlightRequests.set(key, entry);
  
  try {
    return await promise;
  } catch (e) {
    console.warn(`[cache] getCachedOrFetch("${key}") fetchFn failed:`, e.message);
    throw e;
  }
}

export async function healthCheck() {
  try {
    const client = getRedisClient();
    if (!client) return { status: 'disconnected', message: 'Redis client not initialized' };

    await client.ping();
    return { status: 'healthy', message: 'Redis connection is healthy' };
  } catch (e) {
    return { status: 'unhealthy', message: e.message };
  }
}

export async function closeRedisConnection() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('[cache] Redis connection closed gracefully');
      redisClient = null;
    } catch (e) {
      console.warn('[cache] Error closing Redis connection:', e.message);
      if (redisClient) {
        redisClient.disconnect();
        redisClient = null;
      }
    }
  }
  
  if (redisCluster) {
    try {
      await redisCluster.quit();
      console.log('[cache] Redis Cluster connection closed gracefully');
      redisCluster = null;
    } catch (e) {
      console.warn('[cache] Error closing Redis Cluster connection:', e.message);
      if (redisCluster) {
        redisCluster.disconnect();
        redisCluster = null;
      }
    }
  }
}

if (typeof process !== 'undefined') {
  process.on('SIGTERM', closeRedisConnection);
  process.on('SIGINT', closeRedisConnection);
}
