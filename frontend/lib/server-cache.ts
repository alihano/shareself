import "server-only";
import { redis } from "./redis-client";

// Wraps an expensive, server-only computation (an API route's onchain-data
// call) in a Redis cache shared across every serverless instance — unlike
// onchain-data.ts's own in-memory cache, which only dedups calls landing on
// the *same* warm instance and therefore doesn't stop the deployment as a
// whole from re-scanning the chain on every request (see onchain-data.ts's
// comment). Falls back to calling `fn` directly, uncached, if REDIS_URL
// isn't configured (e.g. local dev) or Redis errors.
//
// TTL trades staleness for speed: within this window, a trade might not be
// reflected yet for someone else loading the page. Measured directly
// against the live deployment: a cold scan (empty cache) takes ~230s, so a
// TTL anywhere near that (the original 30s) barely helps — most requests
// still land on an expired entry and re-pay the full 230s. 3 minutes keeps
// the expensive result around for long enough to actually get reused before
// the next scan has to pay that cost again. Fine for testnet-demo scale;
// revisit if that lag becomes a real complaint.
const TTL_SECONDS = 180;

function jsonReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? { $bigint: value.toString() } : value;
}

function jsonReviver(_key: string, value: unknown) {
  if (value && typeof value === "object" && "$bigint" in (value as Record<string, unknown>)) {
    return BigInt((value as { $bigint: string }).$bigint);
  }
  return value;
}

// Belt-and-suspenders on top of redis-client.ts's own connectTimeout: caps
// how long any single Redis op can block this request before we give up on
// it and treat it as a miss, so a slow/wedged connection degrades to an
// uncached direct fetch instead of hanging the whole page.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      }
    );
  });
}

export async function withRedisCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (redis) {
    const raw = await withTimeout(redis.get(key), 3_000);
    if (raw) return JSON.parse(raw, jsonReviver) as T;
  }

  const value = await fn();

  if (redis) {
    await withTimeout(redis.set(key, JSON.stringify(value, jsonReplacer), "EX", TTL_SECONDS), 3_000);
  }
  return value;
}
