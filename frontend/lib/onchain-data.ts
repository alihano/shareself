import { type Address, type Log, zeroAddress } from "viem";
import { publicClient } from "./viem-client";
import { DIRECT_MESSAGING_ADDRESS, directMessagingAbi, userTokenAbi } from "./contracts";
import { getPrice } from "./bonding-curve";

// This module holds the *types* and *pure* log -> typed-result mapping
// helpers shared between the client (several pages/components call these
// types directly, and this file doesn't use `fs` so it's safe to import
// there) and the server-only incremental-scan implementation in
// onchain-data-fast.ts, which is what every API route actually calls for
// real data. The scanning logic itself used to live here too (a plain
// in-memory cache wrapping direct eth_getLogs calls), but that path had no
// Redis persistence and no graceful degradation on failure — an Arc RPC
// rate-limit hit would throw uncaught and crash whatever page called it
// (confirmed in production: the profile page's Server Component crashed
// this way before being switched to onchain-data-fast.ts). Removed once
// every caller was migrated to the fast path (either directly, for server
// components, or through a small API route, for client components) —
// see onchain-data-fast.ts's comment for how the fast path works.

export interface RegisteredUser {
  address: Address;
  username: string;
  token: Address;
}

export interface PricePoint {
  timestamp: number; // ms
  price: bigint; // USDC, 6 decimals
}

export interface TokenStats {
  token: Address;
  totalSupply: bigint;
  currentPrice: bigint;
  holderCount: number;
  volume24h: bigint; // USDC, 6 decimals
}

/** Pure log -> typed-result mapping, shared with the server-only incremental
 *  scan path in onchain-data-fast.ts so both fetching strategies agree on
 *  how a UserRegistered log becomes a RegisteredUser. */
export function mapRegisteredUserLogs(logs: Log[]): RegisteredUser[] {
  return logs.map((log) => {
    const args = (log as unknown as { args: { user: Address; username: string; token: Address } }).args;
    return { address: args.user, username: args.username, token: args.token };
  });
}

export interface TradeEvent {
  trader: Address;
  isBuy: boolean;
  amount: bigint;
  usdcAmount: bigint; // cost (buy) or proceeds (sell), post-fee-split
  blockNumber: bigint;
  logIndex: number;
}

/** Pure log -> typed-result mapping — see mapRegisteredUserLogs's comment. */
export function mapTradeEventLogs(buyLogs: Log[], sellLogs: Log[]): TradeEvent[] {
  const events: TradeEvent[] = [
    ...buyLogs.map((log) => {
      const args = (log as unknown as { args: { buyer: Address; amount: bigint; cost: bigint } }).args;
      return {
        trader: args.buyer,
        isBuy: true,
        amount: args.amount,
        usdcAmount: args.cost,
        blockNumber: log.blockNumber ?? 0n,
        logIndex: log.logIndex ?? 0,
      };
    }),
    ...sellLogs.map((log) => {
      const args = (log as unknown as { args: { seller: Address; amount: bigint; proceeds: bigint } }).args;
      return {
        trader: args.seller,
        isBuy: false,
        amount: args.amount,
        usdcAmount: args.proceeds,
        blockNumber: log.blockNumber ?? 0n,
        logIndex: log.logIndex ?? 0,
      };
    }),
  ];

  events.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
    return a.logIndex - b.logIndex;
  });
  return events;
}

export async function getBlockTimestamps(blockNumbers: bigint[]): Promise<Map<bigint, number>> {
  const unique = Array.from(new Set(blockNumbers));
  const blocks = await Promise.all(unique.map((blockNumber) => publicClient.getBlock({ blockNumber })));
  const map = new Map<bigint, number>();
  blocks.forEach((block, i) => map.set(unique[i], Number(block.timestamp) * 1000));
  return map;
}

/**
 * Reconstructs a token's price-over-time series from its trade events. Walks
 * events newest-to-oldest, unwinding each trade's supply effect against the
 * token's current on-chain totalSupply, so it never needs to know the
 * creator-premint constant baked into SocialFiPlatform.sol.
 */
export function reconstructPriceHistory(
  currentSupply: bigint,
  events: TradeEvent[],
  timestamps: Map<bigint, number>
): PricePoint[] {
  const points: PricePoint[] = [];
  let runningSupply = currentSupply;
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const postTradeSupply = runningSupply;
    points.unshift({
      timestamp: timestamps.get(event.blockNumber) ?? 0,
      price: getPrice(postTradeSupply),
    });
    runningSupply = event.isBuy ? runningSupply - event.amount : runningSupply + event.amount;
  }
  points.push({ timestamp: Date.now(), price: getPrice(currentSupply) });
  return points;
}

export interface TradeHistoryEntry {
  trader: Address;
  isBuy: boolean;
  amount: bigint;
  usdcAmount: bigint;
  timestamp: number;
}

export interface ActivityEntry {
  token: Address;
  username?: string;
  isBuy: boolean;
  amount: bigint;
  usdcAmount: bigint;
  timestamp: number;
  txHash: `0x${string}`;
}

export interface RawActivityEntry {
  token: Address;
  isBuy: boolean;
  amount: bigint;
  usdcAmount: bigint;
  blockNumber: bigint;
  logIndex: number;
  txHash: `0x${string}`;
}

/** Pure log -> typed-result mapping — see mapRegisteredUserLogs's comment. */
export function mapActivityLogs(buyLogs: Log[], sellLogs: Log[]): RawActivityEntry[] {
  const raw: RawActivityEntry[] = [
    ...buyLogs.map((log) => {
      const args = (log as unknown as { args: { token: Address; amount: bigint; cost: bigint } }).args;
      return {
        token: args.token,
        isBuy: true,
        amount: args.amount,
        usdcAmount: args.cost,
        blockNumber: log.blockNumber ?? 0n,
        logIndex: log.logIndex ?? 0,
        txHash: log.transactionHash!,
      };
    }),
    ...sellLogs.map((log) => {
      const args = (log as unknown as { args: { token: Address; amount: bigint; proceeds: bigint } }).args;
      return {
        token: args.token,
        isBuy: false,
        amount: args.amount,
        usdcAmount: args.proceeds,
        blockNumber: log.blockNumber ?? 0n,
        logIndex: log.logIndex ?? 0,
        txHash: log.transactionHash!,
      };
    }),
  ];

  raw.sort((a, b) => (a.blockNumber !== b.blockNumber ? (a.blockNumber < b.blockNumber ? 1 : -1) : b.logIndex - a.logIndex));
  return raw;
}

/** Pure aggregation — see mapRegisteredUserLogs's comment. */
export function compute24hVolume(events: TradeEvent[], timestamps: Map<bigint, number>): bigint {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return events
    .filter((e) => (timestamps.get(e.blockNumber) ?? 0) >= cutoff)
    .reduce((sum, e) => sum + e.usdcAmount, 0n);
}

/** Pure candidate extraction — see mapRegisteredUserLogs's comment. Actual
 *  holder count still needs a live balanceOf() per candidate (a transfer
 *  recipient may have since sold down to zero), done by the caller. */
export function candidateHoldersFromTransferLogs(logs: Log[]): Address[] {
  const candidates = new Set<Address>();
  for (const log of logs) {
    const args = (log as unknown as { args: { to: Address } }).args;
    if (args.to && args.to !== zeroAddress) {
      candidates.add(args.to);
    }
  }
  return Array.from(candidates);
}

export async function countNonzeroHolders(token: Address, candidates: Address[]): Promise<number> {
  const balances = await Promise.all(
    candidates.map(
      (address) =>
        publicClient.readContract({
          address: token,
          abi: userTokenAbi,
          functionName: "balanceOf",
          args: [address],
        }) as Promise<bigint>
    )
  );
  return balances.filter((balance) => balance > 0n).length;
}

export interface LeaderboardEntry extends RegisteredUser {
  stats: TokenStats;
}

export interface Holding extends RegisteredUser {
  balance: bigint;
  currentPrice: bigint;
}

/**
 * A conversation is "unlocked" (train.md) if either side has paid to unlock
 * the other via DirectMessaging.unlockChat.
 */
export async function hasChatAccess(a: Address, b: Address): Promise<boolean> {
  if (!DIRECT_MESSAGING_ADDRESS) return false;
  const [aUnlockedB, bUnlockedA] = await Promise.all([
    publicClient.readContract({
      address: DIRECT_MESSAGING_ADDRESS,
      abi: directMessagingAbi,
      functionName: "hasAccessTo",
      args: [a, b],
    }) as Promise<boolean>,
    publicClient.readContract({
      address: DIRECT_MESSAGING_ADDRESS,
      abi: directMessagingAbi,
      functionName: "hasAccessTo",
      args: [b, a],
    }) as Promise<boolean>,
  ]);
  return aUnlockedB || bUnlockedA;
}
