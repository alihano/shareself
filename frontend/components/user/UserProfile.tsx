"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useUserToken } from "@/hooks/useUserToken";
import { UserStats } from "./UserStats";
import { PriceChart } from "@/components/trading/PriceChart";
import { TradeWidget } from "@/components/trading/TradeWidget";
import { TradeHistory } from "@/components/trading/TradeHistory";
import { UnlockChatButton } from "@/components/messaging/UnlockChatButton";
import { Loading } from "@/components/common/Loading";
import { Avatar } from "@/components/common/Avatar";
import { XIcon } from "@/components/common/XIcon";
import { shortenAddress } from "@/lib/format";

interface TokenApiStats {
  holderCount: number;
  volume24h: string;
}

export function UserProfile({ address, username }: { address: Address; username: string }) {
  const { address: viewer } = useAccount();
  const { data: session } = useSession();
  const { token, totalSupply, currentPrice, isLoading, refetch: refetchUserToken } = useUserToken(address);

  const statsQuery = useQuery({
    queryKey: ["token-stats", token],
    queryFn: async () => (await axios.get<TokenApiStats>(`/api/token/${token}`)).data,
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  if (isLoading) return <Loading label="Loading profile…" />;
  if (!token) {
    return (
      <div className="rounded-2xl border border-border bg-surface py-12 text-center text-muted">
        @{username} isn&apos;t registered on ShareSelf.
      </div>
    );
  }

  const isOwnProfile = viewer?.toLowerCase() === address.toLowerCase();
  const avatarUrl = isOwnProfile && session?.user?.username === username ? session.user.image : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
        <Avatar seed={username} imageUrl={avatarUrl} size="xl" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">@{username}</h1>
            <a
              href={`https://x.com/${username}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`@${username} on X`}
              title={`@${username} on X`}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-foreground transition-colors hover:border-accent/50 hover:text-accent"
            >
              <XIcon className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="text-sm text-muted">{shortenAddress(address)}</p>
        </div>
      </div>

      <UserStats
        totalSupply={totalSupply}
        currentPrice={currentPrice}
        holderCount={statsQuery.data?.holderCount}
        volume24h={statsQuery.data ? BigInt(statsQuery.data.volume24h) : undefined}
      />

      <PriceChart token={token} />

      <div className="grid gap-6 md:grid-cols-2">
        <TradeWidget token={token} onTraded={() => refetchUserToken()} />
        {!isOwnProfile && <UnlockChatButton creator={address} />}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Recent trades</h2>
        <TradeHistory token={token} />
      </div>
    </div>
  );
}
