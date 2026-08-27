import { createPublicClient, http } from "viem";
import { arcTestnet } from "./arc-config";

export const publicClient = createPublicClient({
  chain: arcTestnet,
  // Arc's public RPC rate-limits eth_getLogs on concurrency (train.md), and
  // occasionally a call near the chain tip hangs outright (see
  // rpc-throttle.ts's hard timeout). Earlier this used a long retryCount x
  // retryDelay (6 x 1500ms) to make a single cold, from-scratch scan
  // reliably succeed even if slow — but onchain-data-fast.ts's incremental
  // scan (see its comment) changed the calculus: a scan that fails now just
  // leaves its Redis cursor where it was and picks up the same unfetched
  // range on the *next* request, instead of needing to succeed in one shot.
  // So a long retry chain here no longer buys reliability, it just adds
  // dead time (worst case 6 x ~11.5s = ~70s) to whichever user's request
  // happens to hit a slow moment. Failing fast and letting the next request
  // retry is strictly better now.
  transport: http(undefined, { retryCount: 1, retryDelay: 300 }),
});
