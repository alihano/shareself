import Link from "next/link";
import type { Holding } from "@/lib/onchain-data";
import { formatUsdc, formatShareAmount } from "@/lib/format";
import { Avatar } from "@/components/common/Avatar";

export function PortfolioCard({ holding }: { holding: Holding }) {
  const value = holding.balance * holding.currentPrice;

  return (
    <Link
      href={`/${holding.username}`}
      className="group flex items-center justify-between rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10"
    >
      <div className="flex items-center gap-3">
        <Avatar seed={holding.username} />
        <div>
          <p className="font-semibold text-foreground transition-colors group-hover:gradient-text">
            @{holding.username}
          </p>
          <p className="text-xs text-muted">{formatShareAmount(holding.balance)} shares</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-foreground">{formatUsdc(value)} USDC</p>
        <p className="text-xs text-muted">{formatUsdc(holding.currentPrice)} / share</p>
      </div>
    </Link>
  );
}
