import type { Address } from "viem";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface TokenActivityRow {
  trader: Address;
  isBuy: boolean;
  amount: bigint;
  usdcAmount: bigint;
  timestamp: number;
}

interface TokenActivityRowRaw {
  trader: Address;
  isBuy: boolean;
  amount: string;
  usdcAmount: string;
  timestamp: number;
}

/**
 * A token's recent trade history, for the notifications page's "your token
 * activity" section. Extracted into its own hook (rather than duplicating
 * the useQuery call) because useUnreadNotifications.ts shares this exact
 * query key with app/notifications/page.tsx — react-query dedupes same-key
 * queries onto one cache entry, so both callers must run the identical
 * queryFn or whichever one "wins" silently determines what shape the other
 * sees.
 */
export function useTokenActivity(token?: Address) {
  return useQuery({
    queryKey: ["notifications-token-activity", token],
    queryFn: async () => {
      const res = await apiClient.get<TokenActivityRowRaw[]>("/api/trade-history", { params: { token } });
      return res.data.map((t) => ({ ...t, amount: BigInt(t.amount), usdcAmount: BigInt(t.usdcAmount) })) as TokenActivityRow[];
    },
    enabled: Boolean(token),
    staleTime: 15_000,
  });
}
