import fs from "fs";
import path from "path";
import type { Address } from "viem";

// Server-only. Simple file-based store for DM content (train.md): message
// text lives here, not on-chain — DirectMessaging.sol only tracks the paid
// unlock right. Known limitation: this won't survive a serverless/Vercel
// deploy (ephemeral filesystem) and isn't signature-authenticated; both are
// flagged in train.md as pre-production follow-ups.

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "messages.json");

export interface StoredMessage {
  from: Address;
  to: Address;
  text: string;
  timestamp: number; // ms
}

function readAll(): StoredMessage[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw) as StoredMessage[];
  } catch {
    return [];
  }
}

function writeAll(messages: StoredMessage[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2));
}

function isBetween(message: StoredMessage, a: Address, b: Address): boolean {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  const from = message.from.toLowerCase();
  const to = message.to.toLowerCase();
  return (from === lowerA && to === lowerB) || (from === lowerB && to === lowerA);
}

export function appendMessage(message: StoredMessage): void {
  const messages = readAll();
  messages.push(message);
  writeAll(messages);
}

export function getConversation(a: Address, b: Address): StoredMessage[] {
  return readAll()
    .filter((m) => isBetween(m, a, b))
    .sort((x, y) => x.timestamp - y.timestamp);
}

export interface ConversationSummary {
  counterpart: Address;
  lastMessage: StoredMessage;
}

/** Distinct conversations `address` has taken part in, newest first. */
export function getConversationsForUser(address: Address): ConversationSummary[] {
  const lower = address.toLowerCase();
  const byCounterpart = new Map<string, StoredMessage>();

  for (const message of readAll()) {
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
export function hasNewMessagesSince(address: Address, since: number): boolean {
  const lower = address.toLowerCase();
  return readAll().some(
    (m) => m.to.toLowerCase() === lower && m.from.toLowerCase() !== lower && m.timestamp > since
  );
}
