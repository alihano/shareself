import { createPublicClient, http } from "viem";
import { arcTestnet } from "./arc-config";

export const publicClient = createPublicClient({
  chain: arcTestnet,
  // Arc's public RPC rate-limits eth_getLogs on concurrency (train.md) —
  // lib/rpc-throttle.ts is the primary defense (serializes those calls);
  // this is just a safety net for transient network blips.
  transport: http(undefined, { retryCount: 3, retryDelay: 750 }),
});
