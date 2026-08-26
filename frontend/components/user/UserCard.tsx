import Link from "next/link";
import { formatUsdc } from "@/lib/format";
import type { LeaderboardRow } from "@/hooks/useLeaderboard";
import { Avatar } from "@/components/common/Avatar";

export function UserCard({ row }: { row: LeaderboardRow }) {
  return (
    <Link
      href={`/${row.username}`}
      className="group flex items-center justify-between rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10"
    >
      <div className="flex items-center gap-3">
        <Avatar seed={row.username} />
        <div>
          <p className="font-semibold text-foreground transition-colors group-hover:gradient-text">
            @{row.username}
          </p>
          <p className="text-xs text-muted">{row.holderCount} holders</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-foreground">{formatUsdc(BigInt(row.currentPrice))} USDC</p>
        <p className="text-xs text-muted">{formatUsdc(BigInt(row.volume24h))} 24h vol</p>
      </div>
    </Link>
  );
}
