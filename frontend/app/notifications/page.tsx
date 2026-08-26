"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useUserToken } from "@/hooks/useUserToken";
import { getTradeHistory } from "@/lib/onchain-data";
import { ANNOUNCEMENTS } from "@/lib/announcements";
import { formatUsdc, formatShareAmount, shortenAddress, formatRelativeTime } from "@/lib/format";
import { Loading } from "@/components/common/Loading";
import { Avatar } from "@/components/common/Avatar";
import { markNotificationsSeenNow } from "@/lib/read-state";

function AnnouncementsSection() {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-foreground">Announcements</h2>
      <ul className="flex flex-col gap-3">
        {ANNOUNCEMENTS.map((a) => (
          <li key={a.id} className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">{a.title}</p>
              <span className="text-xs text-muted">{formatRelativeTime(a.timestamp)}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{a.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TokenActivitySection() {
  const { address } = useAccount();
  const { token, username, isRegistered } = useUserToken(address);

  const query = useQuery({
    queryKey: ["notifications-token-activity", token],
    queryFn: () => getTradeHistory(token!),
    enabled: Boolean(token),
    staleTime: 15_000,
  });

  if (!address) return null;
  if (!isRegistered) {
    return (
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Your token activity</h2>
        <p className="text-sm text-muted">Register a profile to see notifications when your shares trade.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-foreground">Your token activity</h2>
      {query.isLoading ? (
        <Loading label="Loading activity…" />
      ) : !query.data || query.data.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface py-8 text-center text-sm text-muted">
          No one has traded @{username} shares yet.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {query.data.map((trade, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Avatar seed={trade.trader} size="sm" />
              <div className="flex flex-1 flex-col">
                <span className="text-foreground">
                  <span className="font-medium">{shortenAddress(trade.trader)}</span>{" "}
                  {trade.isBuy ? "bought" : "sold"} {formatShareAmount(trade.amount)} of your shares
                </span>
                <span className="text-xs text-muted">{formatRelativeTime(trade.timestamp)}</span>
              </div>
              <span className="font-semibold text-foreground">{formatUsdc(trade.usdcAmount)} USDC</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  useEffect(() => {
    markNotificationsSeenNow();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
      <AnnouncementsSection />
      <TokenActivitySection />
    </div>
  );
}
