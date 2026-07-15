const CACHE_PREFIX = "piomdb_api_cache_";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — OMDb metadata is effectively static

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

/**
 * Cache-first wrapper around a fetcher, backed by localStorage. Avoids re-calling
 * OMDb-backed endpoints for data that basically never changes (title, poster,
 * episode lists). Falls straight through to `fetcher` when no cached entry exists
 * yet or it has aged past `ttlMs`.
 */
export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = DEFAULT_TTL_MS): Promise<T> {
  const storageKey = CACHE_PREFIX + key;

  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const entry: CacheEntry<T> = JSON.parse(raw);
        if (Date.now() - entry.fetchedAt < ttlMs) {
          return entry.data;
        }
      } catch {
        // Corrupt entry — fall through and refetch.
      }
    }
  }

  const data = await fetcher();

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ data, fetchedAt: Date.now() } satisfies CacheEntry<T>));
    } catch {
      // Storage full or unavailable — caching is best-effort, not required for correctness.
    }
  }

  return data;
}
