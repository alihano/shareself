import Redis from "ioredis";

// Reused across warm serverless invocations — module scope survives on a
// warm Vercel container, so this avoids a fresh TCP+TLS handshake on every
// request. `null` when REDIS_URL isn't set (e.g. local dev without Redis) —
// callers must treat that as "caching unavailable" and fall through to a
// direct fetch, never throw.
declare global {
  // eslint-disable-next-line no-var
  var __redisClient: Redis | undefined;
}

export const redis: Redis | null = process.env.REDIS_URL
  ? (globalThis.__redisClient ??= new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      connectTimeout: 3_000,
      // ioredis's default retryStrategy backs off and keeps retrying
      // forever on a connection failure, which would otherwise hang the
      // whole request instead of letting server-cache.ts fall back to an
      // uncached direct fetch. Give up after one retry.
      retryStrategy: (times) => (times > 1 ? null : 200),
    }))
  : null;

if (redis) {
  // Without a listener, ioredis's own connection-retry failures surface as
  // an unhandled "error" event and can crash the function; server-cache.ts
  // already guards every command with .catch(), this just keeps the
  // background reconnect noise from taking the process down.
  redis.on("error", () => {});
}
