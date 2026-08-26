"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { useUserToken } from "@/hooks/useUserToken";
import { useMessaging } from "@/hooks/useMessaging";
import { getHoldingsForAddress } from "@/lib/onchain-data";
import { UserStats } from "@/components/user/UserStats";
import { PortfolioCard } from "@/components/user/PortfolioCard";
import { ActivityFeed } from "@/components/user/ActivityFeed";
import { PriceChart } from "@/components/trading/PriceChart";
import { Button } from "@/components/common/Button";
import { Loading } from "@/components/common/Loading";
import { formatUsdc } from "@/lib/format";

interface TokenApiStats {
  holderCount: number;
  volume24h: string;
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { token, username, totalSupply, currentPrice, isRegistered, isLoading } = useUserToken(address);
  const { earnings, withdrawEarnings } = useMessaging();

  const holdingsQuery = useQuery({
    queryKey: ["holdings", address],
    queryFn: () => getHoldingsForAddress(address!),
    enabled: Boolean(address),
    staleTime: 15_000,
  });

  const statsQuery = useQuery({
    queryKey: ["token-stats", token],
    queryFn: async () => (await axios.get<TokenApiStats>(`/api/token/${token}`)).data,
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  if (!isConnected) {
    return <p className="py-12 text-center text-muted">Connect your wallet to see your dashboard.</p>;
  }
  if (isLoading) return <Loading label="Loading dashboard…" />;
  if (!isRegistered) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-muted">You haven&apos;t registered a profile yet.</p>
        <Link href="/register">
          <Button>Register now</Button>
        </Link>
      </div>
    );
  }

  const holdings = holdingsQuery.data ?? [];
  const walletValue = holdings.reduce((sum, h) => sum + h.balance * h.currentPrice, 0n);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">@{username}</h1>
        <div className="mt-4">
          <UserStats
            totalSupply={totalSupply}
            currentPrice={currentPrice}
            holderCount={statsQuery.data?.holderCount}
            volume24h={statsQuery.data ? BigInt(statsQuery.data.volume24h) : undefined}
          />
        </div>
        {token && <div className="mt-4"><PriceChart token={token} /></div>}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5">
        <div>
          <p className="text-sm text-muted">Messaging earnings</p>
          <p className="text-lg font-semibold text-foreground">{earnings !== undefined ? `${formatUsdc(earnings)} USDC` : "—"}</p>
        </div>
        <Button
          variant="secondary"
          disabled={!earnings || earnings === 0n}
          onClick={async () => {
            try {
              await withdrawEarnings();
              toast.success("Withdrawn");
            } catch {
              toast.error("Withdrawal failed");
            }
          }}
        >
          Withdraw
        </Button>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-foreground">Wallet</h2>
          {holdings.length > 0 && (
            <span className="text-sm text-muted">
              Total value: <span className="font-semibold text-foreground">{formatUsdc(walletValue)} USDC</span>
            </span>
          )}
        </div>
        {holdingsQuery.isLoading ? (
          <Loading />
        ) : holdings.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface py-8 text-center text-sm text-muted">
            You don&apos;t own any shares yet — explore users to buy some.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {holdings.map((holding) => (
              <PortfolioCard key={holding.token} holding={holding} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Activity</h2>
        {address && <ActivityFeed address={address} />}
      </div>
    </div>
  );
}
