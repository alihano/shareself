import { formatUsdc, formatShareAmount } from "@/lib/format";

interface UserStatsProps {
  totalSupply?: bigint;
  currentPrice?: bigint;
  holderCount?: number;
  volume24h?: bigint;
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1.5 text-xl font-bold ${highlight ? "gradient-text" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

export function UserStats({ totalSupply, currentPrice, holderCount, volume24h }: UserStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Price" value={currentPrice !== undefined ? `${formatUsdc(currentPrice)} USDC` : "—"} highlight />
      <Stat label="Supply" value={totalSupply !== undefined ? formatShareAmount(totalSupply) : "—"} />
      <Stat label="Holders" value={holderCount !== undefined ? holderCount.toLocaleString() : "—"} />
      <Stat label="24h Volume" value={volume24h !== undefined ? `${formatUsdc(volume24h)} USDC` : "—"} />
    </div>
  );
}
