import { defineChain } from "viem";

// Arc Testnet chain values below come from the project's pasted user prompt
// (see ../../train.md) and have NOT been independently verified against
// official Arc docs. Re-confirm chainId/RPC/explorer before relying on this
// in front of real users.
//
// Native currency here is the *gas* token (18 decimals) — distinct from the
// 6-decimal ERC-20 USDC used for bonding-curve payments and chat unlocks,
// whose address lives in contracts.ts. Never mix the two decimal systems.
const ARC_TESTNET_RPC_URL =
  process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [ARC_TESTNET_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});
