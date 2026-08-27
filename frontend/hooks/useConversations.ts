"use client";

import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ConversationSummary } from "@/lib/messages-store";
import { useMessageAuthToken } from "./useMessageAuthToken";

/**
 * Shared conversations-list query — used by both ConversationList.tsx and
 * useUnreadMessages.ts under the same react-query key, so there's exactly
 * one authenticated fetcher (and one signature prompt) regardless of which
 * mounts first.
 */
export function useConversations() {
  const { address } = useAccount();
  const { getToken } = useMessageAuthToken();

  return useQuery({
    queryKey: ["conversations", address],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Wallet not connected");
      const res = await apiClient.get<ConversationSummary[]>(`/api/messages/conversations/${address}`, {
        params: { timestamp: token.timestamp, signature: token.signature },
      });
      return res.data;
    },
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });
}
