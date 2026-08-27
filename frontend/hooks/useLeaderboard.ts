import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Address } from "viem";

export type LeaderboardSort = "price" | "volume24h" | "newest" | "holders";

export interface LeaderboardRow {
  address: Address;
  username: string;
  token: Address;
  totalSupply: string;
  currentPrice: string;
  holderCount: number;
  volume24h: string;
}

export function useLeaderboard(sortBy: LeaderboardSort = "price") {
  const query = useQuery({
    queryKey: ["leaderboard", sortBy],
    queryFn: async () => {
      const res = await apiClient.get<LeaderboardRow[]>("/api/leaderboard", { params: { sortBy } });
      return res.data;
    },
    staleTime: 30_000,
  });

  return { rows: query.data ?? [], isLoading: query.isLoading, error: query.error };
}
