import fs from "fs";
import path from "path";
import type { Address } from "viem";
import { redis } from "./redis-client";

// Server-only. Message text lives here, not on-chain — DirectMessaging.sol
// only tracks the paid unlock right (train.md). Originally a plain JSON
// file, which doesn't survive Vercel's ephemeral serverless filesystem —
// every send/read landed on a different, empty file, so messaging was
// completely broken in production. Now backed by Redis (already provisioned
// for onchain-data-fast.ts's incremental scan) as one JSON blob under a
// single key; every function below still just filters/sorts that same
// in-memory array, only readAll/writeAll changed. Falls back to the
// original file-based storage when REDIS_URL isn't set (e.g. local dev
// without Redis) so that workflow is unaffected.
//
// Known limitation, unchanged from before: not signature-authenticated at
// the storage layer (the API routes that call this do their own signature
// check — see message-auth.ts — before ever reaching these functions).

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "messages.json");
const REDIS_KEY = "messages:all";

export interface StoredMessage {
  from: Address;
  to: Address;
  text: string;
  timestamp: number; // ms
}

function readAllFromFile(): StoredMessage[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw) as StoredMessage[];
  } catch {
    return [];
  }
}

function writeAllToFile(messages: StoredMessage[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2));
}

async function readAll(): Promise<StoredMessage[]> {
  if (!redis) return readAllFromFile();
  const raw = await redis.get(REDIS_KEY).catch(() => null);
  if (!raw) return [];
  return JSON.parse(raw) as StoredMessage[];
}

async function writeAll(messages: StoredMessage[]): Promise<void> {
  if (!redis) return writeAllToFile(messages);
  await redis.set(REDIS_KEY, JSON.stringify(messages));
}

function isBetween(message: StoredMessage, a: Address, b: Address): boolean {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  const from = message.from.toLowerCase();
  const to = message.to.toLowerCase();
  return (from === lowerA && to === lowerB) || (from === lowerB && to === lowerA);
}

export async function appendMessage(message: StoredMessage): Promise<void> {
  const messages = await readAll();
  messages.push(message);
  await writeAll(messages);
}

export async function getConversation(a: Address, b: Address): Promise<StoredMessage[]> {
  const messages = await readAll();
  return messages.filter((m) => isBetween(m, a, b)).sort((x, y) => x.timestamp - y.timestamp);
}

export interface ConversationSummary {
  counterpart: Address;
  lastMessage: StoredMessage;
}

/** Distinct conversations `address` has taken part in, newest first. */
export async function getConversationsForUser(address: Address): Promise<ConversationSummary[]> {
  const lower = address.toLowerCase();
  const byCounterpart = new Map<string, StoredMessage>();

  for (const message of await readAll()) {
    const from = message.from.toLowerCase();
    const to = message.to.toLowerCase();
    if (from !== lower && to !== lower) continue;

    const counterpart = from === lower ? message.to : message.from;
    const key = counterpart.toLowerCase();
    const existing = byCounterpart.get(key);
    if (!existing || message.timestamp > existing.timestamp) {
      byCounterpart.set(key, message);
    }
  }

  return Array.from(byCounterpart.entries())
    .map(([key, lastMessage]) => ({
      counterpart: (lastMessage.from.toLowerCase() === key ? lastMessage.from : lastMessage.to) as Address,
      lastMessage,
    }))
    .sort((x, y) => y.lastMessage.timestamp - x.lastMessage.timestamp);
}

/**
 * Content-free unread check for the navbar badge: true if someone else sent
 * `address` a message after `since`. Deliberately reveals no text or
 * counterpart — safe to leave unauthenticated (unlike getConversationsForUser
 * / getConversation) so the badge never needs to prompt a wallet signature
 * just from being mounted on every page.
 */
export async function hasNewMessagesSince(address: Address, since: number): Promise<boolean> {
  const lower = address.toLowerCase();
  const messages = await readAll();
  return messages.some(
    (m) => m.to.toLowerCase() === lower && m.from.toLowerCase() !== lower && m.timestamp > since
  );
}
