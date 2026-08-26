import { createPublicClient, http } from "viem";
import { arcTestnet } from "./arc-config";

export const publicClient = createPublicClient({
  chain: arcTestnet,
  // Arc's public RPC rate-limits eth_getLogs on concurrency (train.md).
  // lib/rpc-throttle.ts serializes calls within one serverless invocation,
  // but on Vercel each concurrent request can land on a separate function
  // instance with its own independent throttle queue, so the *deployment*
  // as a whole can still briefly exceed Arc's concurrency cap even though
  // no single instance is issuing overlapping requests. Retrying here is
  // what absorbs those cross-instance collisions instead of failing the
  // request outright.
  // Tried shortening retryDelay to 500ms to speed up the cold (cache-miss)
  // scan — measured directly against the live deployment, it backfired: the
  // retries fired too close together for Arc's rate limiter to recover
  // between attempts, so the request failed outright (500) instead of
  // eventually succeeding. 1500ms reliably completes (measured ~230s cold).
  // Since the Redis cache (server-cache.ts, 180s TTL) means this expensive
  // path only runs occasionally, reliability here matters more than shaving
  // those seconds.
  transport: http(undefined, { retryCount: 6, retryDelay: 1500 }),
});
