"use client";

import type { Address } from "viem";
import { useQuery } from "@tanstack/react-query";
import { getTradeHistory } from "@/lib/onchain-data";
import { formatUsdc, formatShareAmount, shortenAddress, formatRelativeTime } from "@/lib/format";
import { Loading } from "@/components/common/Loading";
import { Avatar } from "@/components/common/Avatar";

interface TradeHistoryProps {
  token: Address;
}

export function TradeHistory({ token }: TradeHistoryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["trade-history", token],
    queryFn: () => getTradeHistory(token),
    staleTime: 15_000,
  });

  if (isLoading) return <Loading label="Loading trades…" />;
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface py-8 text-center text-sm text-muted">
        No trades yet.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {data.map((trade, i) => (
        <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <Avatar seed={trade.trader} size="sm" />
            <div className="flex flex-col">
              <span
                className={
                  trade.isBuy
                    ? "w-fit rounded-full bg-success-bg px-2 py-0.5 text-xs font-semibold text-green-400"
                    : "w-fit rounded-full bg-danger-bg px-2 py-0.5 text-xs font-semibold text-red-400"
                }
              >
                {trade.isBuy ? "BUY" : "SELL"}
              </span>
              <span className="text-xs text-muted">{shortenAddress(trade.trader)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-semibold text-foreground">{formatUsdc(trade.usdcAmount)} USDC</span>
            <span className="text-xs text-muted">
              {formatShareAmount(trade.amount)} shares · {formatRelativeTime(trade.timestamp)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
