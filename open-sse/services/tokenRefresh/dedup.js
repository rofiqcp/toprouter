const REFRESH_RESULT_TTL_MS = 10_000;
const refreshDedupCache = new Map();

export async function dedupRefresh(provider, oldToken, fn, log) {
  if (!oldToken) return fn();
  const key = `${provider}:${oldToken}`;

  // Fast path: check cache first
  const hit = refreshDedupCache.get(key);
  if (hit?.promise) {
    log?.info?.("TOKEN_REFRESH", `Reusing in-flight refresh for ${provider}`);
    return hit.promise;
  }
  if (hit?.result && hit.expiresAt > Date.now()) {
    log?.info?.("TOKEN_REFRESH", `Reusing recent refresh result for ${provider}`);
    return hit.result;
  }
  if (hit?.result) {
    refreshDedupCache.delete(key);
  }

  // Create promise for refresh
  const promise = (async () => {
    try {
      const result = await fn();
      refreshDedupCache.set(key, { result, expiresAt: Date.now() + REFRESH_RESULT_TTL_MS });
      return result;
    } catch (err) {
      refreshDedupCache.delete(key);
      throw err;
    }
  })();

  // Check again before setting - another request may have set it
  const existing = refreshDedupCache.get(key);
  if (existing?.promise) {
    log?.info?.("TOKEN_REFRESH", `Lost race, reusing in-flight refresh for ${provider}`);
    return existing.promise;
  }

  // Atomically set promise in cache
  refreshDedupCache.set(key, { promise });

  // Double-check after set - another request may have won the race
  const afterSet = refreshDedupCache.get(key);
  if (afterSet?.promise !== promise) {
    log?.info?.("TOKEN_REFRESH", `Lost race after set, reusing winner for ${provider}`);
    return afterSet.promise;
  }

  return promise;
}
