import type { Address } from "viem";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PricePoint } from "@/lib/onchain-data";

export function usePriceHistory(token?: Address) {
  const query = useQuery({
    queryKey: ["price-history", token],
    queryFn: async () => {
      const res = await apiClient.get<{ timestamp: number; price: string }[]>("/api/price-history", {
        params: { token },
      });
      return res.data.map((p) => ({ timestamp: p.timestamp, price: BigInt(p.price) })) as PricePoint[];
    },
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  return { priceHistory: query.data ?? [], isLoading: query.isLoading, error: query.error };
}
