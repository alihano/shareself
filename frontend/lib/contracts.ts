import type { Address } from "viem";
import SocialFiPlatformArtifact from "../../artifacts/contracts/SocialFiPlatform.sol/SocialFiPlatform.json";
import DirectMessagingArtifact from "../../artifacts/contracts/DirectMessaging.sol/DirectMessaging.json";
import UserTokenArtifact from "../../artifacts/contracts/UserToken.sol/UserToken.json";

// Contract addresses are never hardcoded (train.md) — they come from
// scripts/deploy.ts writing NEXT_PUBLIC_* vars into frontend/.env.local after
// each deploy. Empty string until .env.local is populated; callers should
// treat "" as "not deployed yet" rather than a valid address.
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "") as Address;
export const SOCIALFI_PLATFORM_ADDRESS = (process.env.NEXT_PUBLIC_SOCIALFI_PLATFORM_ADDRESS ??
  "") as Address;
export const DIRECT_MESSAGING_ADDRESS = (process.env.NEXT_PUBLIC_DIRECT_MESSAGING_ADDRESS ??
  "") as Address;

// Block SocialFiPlatform was deployed at — event-log scans (lib/onchain-data.ts)
// start here instead of block 0, since scanning a live testnet from genesis
// is what tripped Arc's public RPC rate limit (see train.md).
export const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? "0");

// SocialFiPlatform/DirectMessaging/UserToken ABIs are imported straight from
// the Hardhat build output (run `npx hardhat compile` at the repo root) so
// they can never drift from what's actually deployed.
export const socialFiPlatformAbi = SocialFiPlatformArtifact.abi;
export const directMessagingAbi = DirectMessagingArtifact.abi;
export const userTokenAbi = UserTokenArtifact.abi;

// USDC on Arc Testnet is Circle's real contract, not one of ours — MockUSDC
// (contracts/mocks/) is test-only and must not leak into frontend code, so
// this is a small hand-written ERC-20 ABI subset covering what the app needs.
export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;
