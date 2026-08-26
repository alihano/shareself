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
  mapRegisteredUserLogs,
  mapTradeEventLogs,
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

// TEMP diagnostic timing — remove once the latency source is confirmed.
function mark(stateKey: string, label: string, t0: number) {
  console.log(`[scan:${stateKey}] ${label} +${Date.now() - t0}ms`);
}

async function scanEventsIncremental(
  stateKey: string,
  params: Omit<Parameters<typeof publicClient.getContractEvents>[0], "fromBlock" | "toBlock" | "blockHash">
): Promise<Log[]> {
  const t0 = Date.now();
  const latest = await publicClient.getBlockNumber();
  mark(stateKey, "getBlockNumber done", t0);

  let lastBlock = DEPLOY_BLOCK - 1n;
  let logs: Log[] = [];

  if (redis) {
    const raw = await withTimeout(redis.get(stateKey), 3_000);
    mark(stateKey, "redis.get done", t0);
    if (raw) {
      const state = JSON.parse(raw, jsonReviver) as ScanState;
      lastBlock = BigInt(state.lastBlock);
      logs = state.logs;
    }
  }

  if (latest <= lastBlock) {
    mark(stateKey, `no new blocks, returning ${logs.length} cached logs`, t0);
    return logs;
  }

  const newLogs: Log[] = [];
  let chunkCount = 0;
  for (let start = lastBlock + 1n; start <= latest; start += MAX_BLOCK_RANGE + 1n) {
    const end = start + MAX_BLOCK_RANGE < latest ? start + MAX_BLOCK_RANGE : latest;
    const chunk = await throttledRpc(() => publicClient.getContractEvents({ ...params, fromBlock: start, toBlock: end }));
    newLogs.push(...chunk);
    chunkCount++;
    mark(stateKey, `chunk ${chunkCount} done (${start}-${end}, ${chunk.length} logs)`, t0);
  }

  const allLogs = [...logs, ...newLogs];

  if (redis) {
    const state: ScanState = { lastBlock: latest.toString(), logs: allLogs };
    await withTimeout(redis.set(stateKey, JSON.stringify(state, jsonReplacer), "EX", STATE_TTL_SECONDS), 5_000);
    mark(stateKey, "redis.set done", t0);
  }

  mark(stateKey, `TOTAL done, ${chunkCount} chunks, ${allLogs.length} logs`, t0);
  return allLogs;
}

export async function getAllRegisteredUsersFast(): Promise<RegisteredUser[]> {
  const logs = await scanEventsIncremental("scan:registered-users", {
    address: SOCIALFI_PLATFORM_ADDRESS,
    abi: socialFiPlatformAbi,
    eventName: "UserRegistered",
  });
  return mapRegisteredUserLogs(logs);
}

export async function getUsernameForAddressFast(address: Address): Promise<RegisteredUser | null> {
  const users = await getAllRegisteredUsersFast();
  return users.find((u) => u.address.toLowerCase() === address.toLowerCase()) ?? null;
}

async function getTradeEventsForTokenFast(token: Address) {
  const [buyLogs, sellLogs] = await Promise.all([
    scanEventsIncremental(`scan:trades-buy:${token.toLowerCase()}`, {
      address: SOCIALFI_PLATFORM_ADDRESS,
      abi: socialFiPlatformAbi,
      eventName: "TokensBought",
      args: { token },
    }),
    scanEventsIncremental(`scan:trades-sell:${token.toLowerCase()}`, {
      address: SOCIALFI_PLATFORM_ADDRESS,
      abi: socialFiPlatformAbi,
      eventName: "TokensSold",
      args: { token },
    }),
  ]);
  return mapTradeEventLogs(buyLogs, sellLogs);
}

async function getHolderCountFast(token: Address): Promise<number> {
  const logs = await scanEventsIncremental(`scan:transfers:${token.toLowerCase()}`, {
    address: token,
    abi: userTokenAbi,
    eventName: "Transfer",
  });
  return countNonzeroHolders(token, candidateHoldersFromTransferLogs(logs));
}

export async function getTokenStatsFast(token: Address): Promise<TokenStats> {
  const [totalSupply, holderCount, events] = await Promise.all([
    publicClient.readContract({ address: token, abi: userTokenAbi, functionName: "totalSupply" }) as Promise<bigint>,
    getHolderCountFast(token),
    getTradeEventsForTokenFast(token),
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
  const t0 = Date.now();
  const users = await getAllRegisteredUsersFast();
  console.log(`[leaderboard] got ${users.length} users +${Date.now() - t0}ms`);
  const stats = await Promise.all(users.map((u) => getTokenStatsFast(u.token)));
  console.log(`[leaderboard] TOTAL done +${Date.now() - t0}ms`);
  return users.map((user, i) => ({ ...user, stats: stats[i] }));
}

export async function getPriceHistoryFast(token: Address): Promise<PricePoint[]> {
  const [currentSupply, events] = await Promise.all([
    publicClient.readContract({ address: token, abi: userTokenAbi, functionName: "totalSupply" }) as Promise<bigint>,
    getTradeEventsForTokenFast(token),
  ]);

  const timestamps = await getBlockTimestamps(events.map((e) => e.blockNumber));
  return reconstructPriceHistory(currentSupply, events, timestamps);
}
