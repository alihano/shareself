import { formatUnits, parseUnits } from "viem";

// ERC-20 USDC on Arc Testnet is 6 decimals (train.md) — every USDC amount
// flowing through this file uses that, never the 18-decimal native gas token.
const USDC_DECIMALS = 6;

export function formatUsdc(amount: bigint, fractionDigits = 4): string {
  const value = Number(formatUnits(amount, USDC_DECIMALS));
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

export function parseUsdc(amount: string): bigint {
  return parseUnits(amount || "0", USDC_DECIMALS);
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length < 2 + chars * 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function formatShareAmount(amount: bigint): string {
  return amount.toLocaleString("en-US");
}

export function formatRelativeTime(timestampMs: number): string {
  const diffSeconds = Math.round((timestampMs - Date.now()) / 1000);
  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secondsInUnit] of divisions) {
    if (Math.abs(diffSeconds) >= secondsInUnit || unit === "second") {
      return rtf.format(Math.round(diffSeconds / secondsInUnit), unit);
    }
  }
  return rtf.format(0, "second");
}
