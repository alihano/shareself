import "server-only";
import { type Address, type Log } from "viem";
import { publicClient } from "./viem-client";
import { throttledRpc } from "./rpc-throttle";
import { redis } from "./redis-client";
import { DEPLOY_BLOCK, SOCIALFI_PLATFORM_ADDRESS, socialFiPlatformAbi, userTokenAbi } from "./contracts";
import { getPrice } from "./bonding-curve";
import {
  type RegisteredUser,
  type TokenStats,
  type LeaderboardEntry,
  type PricePoint,
  type TradeHistoryEntry,
  type ActivityEntry,
  type Holding,
  mapRegisteredUserLogs,
  mapTradeEventLogs,
  mapActivityLogs,
  reconstructPriceHistory,
  compute24hVolume,
  candidateHoldersFromTransferLogs,
  countNonzeroHolders,
  getBlockTimestamps,
} from "./onchain-data";

// The actual fix for /api/leaderboard etc. taking minutes: onchain-data.ts's
// exported functions re-scan the *entire* DEPLOY_BLOCK..latest range on every
// cache miss, and a bounded TTL (server-cache.ts) can't help once a single
// cold scan already costs more than the TTL — most requests still land on an
// expired/missing entry and re-pay the full scan. This persists "how far
// we've scanned" plus the accumulated logs in Redis, so every call after the
// first one only fetches the delta since the last scan (typically a handful
// of blocks) instead of the full history, however far the chain has moved
// on. Falls back to an uncached full scan (no persistence) if REDIS_URL
// isn't configured, e.g. local dev — same as onchain-data.ts's own fallback.
const MAX_BLOCK_RANGE = 25_000n;
// Long enough that the indexed state effectively never needs to expire
// during the demo's lifetime; just a ceiling so an abandoned deployment
// doesn't hold onto data forever.
const STATE_TTL_SECONDS = 30 * 24 * 60 * 60;

function jsonReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? { $bigint: value.toString() } : value;
}

function jsonReviver(_key: string, value: unknown) {
  if (value && typeof value === "object" && "$bigint" in (value as Record<string, unknown>)) {
    return BigInt((value as { $bigint: string }).$bigint);
  }
  return value;
}

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

interface ScanState {
  lastBlock: string;
  logs: Log[];
}

// Found via production diagnostics: an eth_getLogs call querying a range
// that includes the last few not-yet-fully-propagated blocks occasionally
// never resolves or rejects at all on Arc's RPC. Staying a small safety
// margin behind the tip avoids that bleeding edge entirely; those last few
// blocks just get picked up on the next call once they're no longer newest.
const SAFETY_MARGIN_BLOCKS = 5n;

// A single /api/leaderboard call needs up to 7 of these scans (registered
// users + holder-count/bought/sold for each token). Each used to call
// getBlockNumber() independently — 7 separate round trips to a sometimes-
// slow shared public RPC, each a chance to hit a slow one. Callers that
// need multiple scans for one request (getLeaderboardFast, getTokenStatsFast)
// fetch this once and pass it to every scan instead.
export async function getSafeLatestBlock(): Promise<bigint> {
  const chainTip = await publicClient.getBlockNumber();
  return chainTip > SAFETY_MARGIN_BLOCKS ? chainTip - SAFETY_MARGIN_BLOCKS : chainTip;
}

async function scanEventsIncremental(
  stateKey: string,
  latest: bigint,
  params: Omit<Parameters<typeof publicClient.getContractEvents>[0], "fromBlock" | "toBlock" | "blockHash">
): Promise<Log[]> {
  let lastBlock = DEPLOY_BLOCK - 1n;
  let logs: Log[] = [];

  if (redis) {
    const raw = await withTimeout(redis.get(stateKey), 3_000);
    if (raw) {
      const state = JSON.parse(raw, jsonReviver) as ScanState;
      lastBlock = BigInt(state.lastBlock);
      logs = state.logs;
    }
  }

  if (latest <= lastBlock) {
    return logs;
  }

  // A chunk fetch can still fail outright (rpc-throttle.ts's hard timeout
  // rejects rather than hanging forever) — treat that as "no progress this
  // round" instead of failing the whole page: return whatever was already
  // cached/fetched, without advancing lastBlock past the failure, so the
  // next call just retries the same still-unfetched range.
  const newLogs: Log[] = [];
  let reachedBlock = lastBlock;
  try {
    for (let start = lastBlock + 1n; start <= latest; start += MAX_BLOCK_RANGE + 1n) {
      const end = start + MAX_BLOCK_RANGE < latest ? start + MAX_BLOCK_RANGE : latest;
      const chunk = await throttledRpc(() => publicClient.getContractEvents({ ...params, fromBlock: start, toBlock: end }));
      newLogs.push(...chunk);
      reachedBlock = end;
    }
  } catch {
    // Leave reachedBlock wherever it got to — the next call just retries
    // whatever range wasn't reached yet, see comment above.
  }

  const allLogs = [...logs, ...newLogs];

  if (redis && reachedBlock > lastBlock) {
    const state: ScanState = { lastBlock: reachedBlock.toString(), logs: allLogs };
    await withTimeout(redis.set(stateKey, JSON.stringify(state, jsonReplacer), "EX", STATE_TTL_SECONDS), 5_000);
  }

  return allLogs;
}

export async function getAllRegisteredUsersFast(latest?: bigint): Promise<RegisteredUser[]> {
  const l = latest ?? (await getSafeLatestBlock());
  const logs = await scanEventsIncremental(
    "scan:registered-users",
    l,
    { address: SOCIALFI_PLATFORM_ADDRESS, abi: socialFiPlatformAbi, eventName: "UserRegistered" }
  );
  return mapRegisteredUserLogs(logs);
}

export async function getUsernameForAddressFast(address: Address, latest?: bigint): Promise<RegisteredUser | null> {
  const users = await getAllRegisteredUsersFast(latest);
  return users.find((u) => u.address.toLowerCase() === address.toLowerCase()) ?? null;
}

export async function getUserByUsernameFast(username: string, latest?: bigint): Promise<RegisteredUser | null> {
  const users = await getAllRegisteredUsersFast(latest);
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

async function getTradeEventsForTokenFast(token: Address, latest: bigint) {
  const [buyLogs, sellLogs] = await Promise.all([
    scanEventsIncremental(`scan:trades-buy:${token.toLowerCase()}`, latest, {
      address: SOCIALFI_PLATFORM_ADDRESS,
      abi: socialFiPlatformAbi,
      eventName: "TokensBought",
      args: { token },
    }),
    scanEventsIncremental(`scan:trades-sell:${token.toLowerCase()}`, latest, {
      address: SOCIALFI_PLATFORM_ADDRESS,
      abi: socialFiPlatformAbi,
      eventName: "TokensSold",
      args: { token },
    }),
  ]);
  return mapTradeEventLogs(buyLogs, sellLogs);
}

async function getHolderCountFast(token: Address, latest: bigint): Promise<number> {
  const logs = await scanEventsIncremental(`scan:transfers:${token.toLowerCase()}`, latest, {
    address: token,
    abi: userTokenAbi,
    eventName: "Transfer",
  });
  return countNonzeroHolders(token, candidateHoldersFromTransferLogs(logs));
}

export async function getTokenStatsFast(token: Address, latest?: bigint): Promise<TokenStats> {
  const l = latest ?? (await getSafeLatestBlock());
  const [totalSupply, holderCount, events] = await Promise.all([
    publicClient.readContract({ address: token, abi: userTokenAbi, functionName: "totalSupply" }) as Promise<bigint>,
    getHolderCountFast(token, l),
    getTradeEventsForTokenFast(token, l),
  ]);

  const timestamps = await getBlockTimestamps(events.map((e) => e.blockNumber));

  return {
    token,
    totalSupply,
    currentPrice: getPrice(totalSupply),
    holderCount,
    volume24h: compute24hVolume(events, timestamps),
  };
}

export async function getLeaderboardFast(): Promise<LeaderboardEntry[]> {
  const latest = await getSafeLatestBlock();
  const users = await getAllRegisteredUsersFast(latest);
  const stats = await Promise.all(users.map((u) => getTokenStatsFast(u.token, latest)));
  return users.map((user, i) => ({ ...user, stats: stats[i] }));
}

export async function getPriceHistoryFast(token: Address): Promise<PricePoint[]> {
  const latest = await getSafeLatestBlock();
  const [currentSupply, events] = await Promise.all([
    publicClient.readContract({ address: token, abi: userTokenAbi, functionName: "totalSupply" }) as Promise<bigint>,
    getTradeEventsForTokenFast(token, latest),
  ]);

  const timestamps = await getBlockTimestamps(events.map((e) => e.blockNumber));
  return reconstructPriceHistory(currentSupply, events, timestamps);
}

/** Newest-first trade log for a token, for components/trading/TradeHistory.tsx
 *  and the notifications page's "your token activity" section. */
export async function getTradeHistoryFast(token: Address, limit = 25): Promise<TradeHistoryEntry[]> {
  const latest = await getSafeLatestBlock();
  const events = await getTradeEventsForTokenFast(token, latest);
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

/**
 * A wallet's own buy/sell activity across every token (not just one) — for
 * the dashboard's Activity feed. `buyer`/`seller` are indexed on
 * TokensBought/TokensSold, so this filters directly at the RPC level
 * instead of scanning every token's trades and matching the trader.
 */
export async function getUserActivityFast(address: Address, limit = 50): Promise<ActivityEntry[]> {
  const latest = await getSafeLatestBlock();
  const [buyLogs, sellLogs, users] = await Promise.all([
    scanEventsIncremental(`scan:activity-buy:${address.toLowerCase()}`, latest, {
      address: SOCIALFI_PLATFORM_ADDRESS,
      abi: socialFiPlatformAbi,
      eventName: "TokensBought",
      args: { buyer: address },
    }),
    scanEventsIncremental(`scan:activity-sell:${address.toLowerCase()}`, latest, {
      address: SOCIALFI_PLATFORM_ADDRESS,
      abi: socialFiPlatformAbi,
      eventName: "TokensSold",
      args: { seller: address },
    }),
    getAllRegisteredUsersFast(latest),
  ]);

  const usernameByToken = new Map(users.map((u) => [u.token.toLowerCase(), u.username]));
  const raw = mapActivityLogs(buyLogs, sellLogs);
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

/** Every token `holder` owns a nonzero balance of, across all registered
 *  users — for the dashboard's Wallet section. */
export async function getHoldingsForAddressFast(holder: Address): Promise<Holding[]> {
  const latest = await getSafeLatestBlock();
  const users = await getAllRegisteredUsersFast(latest);
  const [balances, supplies] = await Promise.all([
    Promise.all(
      users.map(
        (u) =>
          publicClient.readContract({
            address: u.token,
            abi: userTokenAbi,
            functionName: "balanceOf",
            args: [holder],
          }) as Promise<bigint>
      )
    ),
    Promise.all(
      users.map(
        (u) =>
          publicClient.readContract({ address: u.token, abi: userTokenAbi, functionName: "totalSupply" }) as Promise<bigint>
      )
    ),
  ]);

  return users
    .map((user, i) => ({ ...user, balance: balances[i], currentPrice: getPrice(supplies[i]) }))
    .filter((h) => h.balance > 0n);
}
