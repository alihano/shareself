"use client";

import Link from "next/link";
import { Button } from "@/components/common/Button";
import { Avatar } from "@/components/common/Avatar";
import { Loading } from "@/components/common/Loading";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { formatUsdc } from "@/lib/format";

export default function Home() {
  const { rows, isLoading } = useLeaderboard("price");
  const top = rows.slice(0, 4);

  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <span className="rounded-full border border-accent/30 bg-accent/10 px-4 py-1 text-xs font-medium text-accent">
          Arc Testnet · Demo
        </span>
        <h1 className="max-w-2xl text-5xl font-extrabold tracking-tight sm:text-6xl">
          Be a partner, <span className="gradient-text">not just a follower.</span>
        </h1>
        <p className="max-w-xl text-muted">
          ShareSelf is a SocialFi demo on Arc Testnet. Sign in with X, launch your own bonding-curve share token,
          and trade shares in the people you follow — with gated messaging built in.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/register">
            <Button>Register your profile</Button>
          </Link>
          <Link href="/explore">
            <Button variant="secondary">Explore users</Button>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-muted">
          Trending profiles
        </h2>
        {isLoading ? (
          <Loading />
        ) : top.length === 0 ? (
          <p className="text-center text-sm text-muted">No one's registered yet — be the first.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {top.map((row) => (
              <Link
                key={row.address}
                href={`/${row.username}`}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-5 transition-all hover:-translate-y-1 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10"
              >
                <Avatar seed={row.username} size="lg" />
                <p className="font-semibold text-foreground transition-colors group-hover:gradient-text">
                  @{row.username}
                </p>
                <p className="text-sm text-muted">{formatUsdc(BigInt(row.currentPrice))} USDC</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
