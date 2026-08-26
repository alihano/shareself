"use client";

import type { Address } from "viem";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getUserActivity } from "@/lib/onchain-data";
import { formatUsdc, formatShareAmount, formatRelativeTime } from "@/lib/format";
import { Loading } from "@/components/common/Loading";
import { Avatar } from "@/components/common/Avatar";
import { arcTestnet } from "@/lib/arc-config";

export function ActivityFeed({ address }: { address: Address }) {
  const { data, isLoading } = useQuery({
    queryKey: ["activity", address],
    queryFn: () => getUserActivity(address),
    staleTime: 15_000,
  });

  if (isLoading) return <Loading label="Loading activity…" />;
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface py-8 text-center text-sm text-muted">
        No activity yet — buy or sell some shares to see it here.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {data.map((entry, i) => (
        <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <Avatar seed={entry.username ?? entry.token} size="sm" />
            <div className="flex flex-col">
              <span className="text-foreground">
                <span
                  className={
                    entry.isBuy
                      ? "mr-1.5 rounded-full bg-success-bg px-2 py-0.5 text-xs font-semibold text-green-400"
                      : "mr-1.5 rounded-full bg-danger-bg px-2 py-0.5 text-xs font-semibold text-red-400"
                  }
                >
                  {entry.isBuy ? "BUY" : "SELL"}
                </span>
                {entry.username ? (
                  <Link href={`/${entry.username}`} className="font-medium hover:text-accent">
                    @{entry.username}
                  </Link>
                ) : (
                  <span className="font-medium">Unknown token</span>
                )}
              </span>
              <span className="text-xs text-muted">{formatRelativeTime(entry.timestamp)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-semibold text-foreground">{formatUsdc(entry.usdcAmount)} USDC</span>
            <a
              href={`${arcTestnet.blockExplorers.default.url}/tx/${entry.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted hover:text-accent"
            >
              {formatShareAmount(entry.amount)} shares ↗
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
