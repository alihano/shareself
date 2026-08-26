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
  // retryDelay is short on purpose: a live test against Arc's RPC showed a
  // rate-limited call succeeds again immediately on the very next attempt,
  // so a long fixed delay here mostly just adds dead time across the many
  // sequential chunked calls a single page load can trigger, without
  // buying extra reliability.
  transport: http(undefined, { retryCount: 6, retryDelay: 500 }),
});
