import { type Address, type Log, zeroAddress } from "viem";
import { publicClient } from "./viem-client";
import {
  DEPLOY_BLOCK,
  DIRECT_MESSAGING_ADDRESS,
  SOCIALFI_PLATFORM_ADDRESS,
  directMessagingAbi,
  socialFiPlatformAbi,
  userTokenAbi,
} from "./contracts";
import { getPrice } from "./bonding-curve";
import { throttledRpc } from "./rpc-throttle";

// Arc Testnet's public RPC rejects eth_getLogs once the fromBlock..toBlock
// range grows past some cap ("requested range too large", code -32012) — it
// didn't error right after deploy when the range was still small, but as the
// chain advances past DEPLOY_BLOCK the single fromBlock:DEPLOY_BLOCK,
// toBlock:"latest" calls below eventually exceed that cap. This splits any
// such call into fixed-size windows (still funneled through throttledRpc, one
// at a time) so the range per request stays under the cap no matter how far
// the chain has advanced.
const MAX_BLOCK_RANGE = 20_000n;

async function getContractEventsChunked(
  params: Omit<Parameters<typeof publicClient.getContractEvents>[0], "fromBlock" | "toBlock" | "blockHash"> & {
    fromBlock: bigint;
  }
): Promise<Log[]> {
  const latest = await publicClient.getBlockNumber();

  const logs: Log[] = [];
  for (let start = params.fromBlock; start <= latest; start += MAX_BLOCK_RANGE + 1n) {
    const end = start + MAX_BLOCK_RANGE < latest ? start + MAX_BLOCK_RANGE : latest;
    const chunk = await throttledRpc(() =>
      publicClient.getContractEvents({ ...params, fromBlock: start, toBlock: end })
    );
    logs.push(...chunk);
  }
  return logs;
}

// No enumerable "all users" getter exists on SocialFiPlatform (train.md) —
// every function here derives its answer by scanning event logs instead of
// reading from a separate index/DB. Fine at testnet-demo scale; revisit with
// a real indexer if the registered-user count grows large (see train.md).

// A single profile page independently asks for the same token's trade
// events 3 times over (24h volume, price history, trade history) — without
// this, that burst of concurrent eth_getLogs calls is exactly what tripped
// Arc Testnet's public RPC rate limit (see train.md). Short TTL + in-flight
// dedup collapses near-simultaneous callers onto one real request.
const CACHE_TTL_MS = 5_000;
const requestCache = new Map<string, { promise: Promise<unknown>; expires: number }>();

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = requestCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise as Promise<T>;

  const promise = fn();
  requestCache.set(key, { promise, expires: Date.now() + CACHE_TTL_MS });
  promise.catch(() => requestCache.delete(key)); // don't cache failures
  return promise;
}

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

function assertPlatformConfigured() {
  if (!SOCIALFI_PLATFORM_ADDRESS) {
    throw new Error("SocialFiPlatform address not configured (NEXT_PUBLIC_SOCIALFI_PLATFORM_ADDRESS)");
  }
}

export async function getAllRegisteredUsers(): Promise<RegisteredUser[]> {
  assertPlatformConfigured();
  return cached("registered-users", async () => {
    const logs = await getContractEventsChunked({
      address: SOCIALFI_PLATFORM_ADDRESS,
      abi: socialFiPlatformAbi,
      eventName: "UserRegistered",
      fromBlock: DEPLOY_BLOCK,
    });

    return logs.map((log) => {
      const args = (log as unknown as { args: { user: Address; username: string; token: Address } }).args;
      return { address: args.user, username: args.username, token: args.token };
    });
  });
}

export async function getUsernameForAddress(address: Address): Promise<RegisteredUser | null> {
  const users = await getAllRegisteredUsers();
  return users.find((u) => u.address.toLowerCase() === address.toLowerCase()) ?? null;
}

export async function getUserByUsername(username: string): Promise<RegisteredUser | null> {
  const users = await getAllRegisteredUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

interface TradeEvent {
  trader: Address;
  isBuy: boolean;
  amount: bigint;
  usdcAmount: bigint; // cost (buy) or proceeds (sell), post-fee-split
  blockNumber: bigint;
  logIndex: number;
}

function getTradeEventsForToken(token: Address): Promise<TradeEvent[]> {
  assertPlatformConfigured();
  return cached(`trade-events:${token.toLowerCase()}`, async () => {
    const [buyLogs, sellLogs] = await Promise.all([
      getContractEventsChunked({
        address: SOCIALFI_PLATFORM_ADDRESS,
        abi: socialFiPlatformAbi,
        eventName: "TokensBought",
        args: { token },
        fromBlock: DEPLOY_BLOCK,
      }),
      getContractEventsChunked({
        address: SOCIALFI_PLATFORM_ADDRESS,
        abi: socialFiPlatformAbi,
        eventName: "TokensSold",
        args: { token },
        fromBlock: DEPLOY_BLOCK,
      }),
    ]);

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
  });
}

async function getBlockTimestamps(blockNumbers: bigint[]): Promise<Map<bigint, number>> {
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
export async function getPriceHistory(token: Address): Promise<PricePoint[]> {
  const [currentSupply, events] = await Promise.all([
    publicClient.readContract({ address: token, abi: userTokenAbi, functionName: "totalSupply" }) as Promise<bigint>,
    getTradeEventsForToken(token),
  ]);

  const timestamps = await getBlockTimestamps(events.map((e) => e.blockNumber));

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

/** Newest-first trade log for a token, for components/trading/TradeHistory.tsx. */
export async function getTradeHistory(token: Address, limit = 25): Promise<TradeHistoryEntry[]> {
  const events = await getTradeEventsForToken(token);
  const recent = events.slice(-limit).reverse();
  const timestamps = await getBlockTimestamps(recent.map((e) => e.blockNumber));

  return recent.map((e) => ({
    trader: e.trader,
    isBuy: e.isBuy,
    amount: e.amount,
    usdcAmount: e.usdcAmount,
    timestamp: timestamps.get(e.blockNumber) ?? 0,
  }));
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

/**
 * A wallet's own buy/sell activity across every token (not just one) — for
 * the dashboard's Activity feed. `buyer`/`seller` are indexed on
 * TokensBought/TokensSold, so this filters directly at the RPC level
 * instead of scanning every token's trades and matching the trader.
 */
export async function getUserActivity(address: Address, limit = 50): Promise<ActivityEntry[]> {
  assertPlatformConfigured();
  const [buyLogs, sellLogs, users] = await Promise.all([
    getContractEventsChunked({
      address: SOCIALFI_PLATFORM_ADDRESS,
      abi: socialFiPlatformAbi,
      eventName: "TokensBought",
      args: { buyer: address },
      fromBlock: DEPLOY_BLOCK,
    }),
    getContractEventsChunked({
      address: SOCIALFI_PLATFORM_ADDRESS,
      abi: socialFiPlatformAbi,
      eventName: "TokensSold",
      args: { seller: address },
      fromBlock: DEPLOY_BLOCK,
    }),
    getAllRegisteredUsers(),
  ]);

  const usernameByToken = new Map(users.map((u) => [u.token.toLowerCase(), u.username]));

  type RawEntry = {
    token: Address;
    isBuy: boolean;
    amount: bigint;
    usdcAmount: bigint;
    blockNumber: bigint;
    logIndex: number;
    txHash: `0x${string}`;
  };

  const raw: RawEntry[] = [
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
  const recent = raw.slice(0, limit);
  const timestamps = await getBlockTimestamps(recent.map((e) => e.blockNumber));

  return recent.map((e) => ({
    token: e.token,
    username: usernameByToken.get(e.token.toLowerCase()),
    isBuy: e.isBuy,
    amount: e.amount,
    usdcAmount: e.usdcAmount,
    timestamp: timestamps.get(e.blockNumber) ?? 0,
    txHash: e.txHash,
  }));
}

export async function get24hVolume(token: Address): Promise<bigint> {
  const events = await getTradeEventsForToken(token);
  if (events.length === 0) return 0n;

  const timestamps = await getBlockTimestamps(events.map((e) => e.blockNumber));
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return events
    .filter((e) => (timestamps.get(e.blockNumber) ?? 0) >= cutoff)
    .reduce((sum, e) => sum + e.usdcAmount, 0n);
}

export function getHolderCount(token: Address): Promise<number> {
  return cached(`holder-count:${token.toLowerCase()}`, async () => {
    const logs = await getContractEventsChunked({
      address: token,
      abi: userTokenAbi,
      eventName: "Transfer",
      fromBlock: DEPLOY_BLOCK,
    });

    const candidates = new Set<Address>();
    for (const log of logs) {
      const args = (log as unknown as { args: { to: Address } }).args;
      if (args.to && args.to !== zeroAddress) {
        candidates.add(args.to);
      }
    }

    const balances = await Promise.all(
      Array.from(candidates).map((address) =>
        publicClient.readContract({
          address: token,
          abi: userTokenAbi,
          functionName: "balanceOf",
          args: [address],
        }) as Promise<bigint>
      )
    );

    return balances.filter((balance) => balance > 0n).length;
  });
}

export async function getTokenStats(token: Address): Promise<TokenStats> {
  const [totalSupply, holderCount, volume24h] = await Promise.all([
    publicClient.readContract({ address: token, abi: userTokenAbi, functionName: "totalSupply" }) as Promise<bigint>,
    getHolderCount(token),
    get24hVolume(token),
  ]);

  return {
    token,
    totalSupply,
    currentPrice: getPrice(totalSupply),
    holderCount,
    volume24h,
  };
}

export interface LeaderboardEntry extends RegisteredUser {
  stats: TokenStats;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const users = await getAllRegisteredUsers();
  const stats = await Promise.all(users.map((u) => getTokenStats(u.token)));
  return users.map((user, i) => ({ ...user, stats: stats[i] }));
}

export interface Holding extends RegisteredUser {
  balance: bigint;
  currentPrice: bigint;
}

/** Every token `holder` owns a nonzero balance of, across all registered users. */
export async function getHoldingsForAddress(holder: Address): Promise<Holding[]> {
  const users = await getAllRegisteredUsers();
  const [balances, supplies] = await Promise.all([
    Promise.all(
      users.map((u) =>
        publicClient.readContract({
          address: u.token,
          abi: userTokenAbi,
          functionName: "balanceOf",
          args: [holder],
        }) as Promise<bigint>
      )
    ),
    Promise.all(
      users.map((u) =>
        publicClient.readContract({
          address: u.token,
          abi: userTokenAbi,
          functionName: "totalSupply",
        }) as Promise<bigint>
      )
    ),
  ]);

  return users
    .map((user, i) => ({ ...user, balance: balances[i], currentPrice: getPrice(supplies[i]) }))
    .filter((h) => h.balance > 0n);
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
