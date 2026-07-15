// TMDB's documented burst limit is ~50 req/s; both the server-side limiter
// below and client-side ETA estimates (e.g. in the TV Time importer) share
// this constant so the progress bar's estimate matches the real throttle.
export const TMDB_RATE_PER_SECOND = 45;

/**
 * Simple server-side token-bucket rate limiter. Shared across all requests to
 * a given Next.js server process, so a bulk operation (e.g. importing 300+
 * shows) can fire many concurrent client requests without ever exceeding the
 * upstream API's rate limit — callers just await a slot and the queue drains
 * itself at a fixed rate instead of erroring out or freezing anything.
 */
export function createRateLimiter(ratePerSecond: number) {
  let tokens = ratePerSecond;
  const queue: (() => void)[] = [];

  setInterval(() => {
    tokens = ratePerSecond;
    while (tokens > 0 && queue.length > 0) {
      tokens--;
      queue.shift()!();
    }
  }, 1000).unref();

  return function acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (tokens > 0) {
        tokens--;
        resolve();
      } else {
        queue.push(resolve);
      }
    });
  };
}
