import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { ConversationSummary } from "@/lib/messages-store";
import { getLastSeenMessagesAt } from "@/lib/read-state";

/**
 * True if any conversation has a message newer than the last time the user
 * visited /messages, sent by the other party (not themselves). Shares the
 * same react-query key as ConversationList.tsx, so mounting both the navbar
 * badge and the messages page doesn't double the network cost.
 */
export function useUnreadMessages() {
  const { address } = useAccount();
  const [lastSeen, setLastSeen] = useState(0);

  useEffect(() => {
    setLastSeen(getLastSeenMessagesAt());
  }, []);

  const query = useQuery({
    queryKey: ["conversations", address],
    queryFn: async () => (await axios.get<ConversationSummary[]>(`/api/messages/conversations/${address}`)).data,
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });

  const hasUnread = Boolean(
    address &&
      query.data?.some(
        (c) => c.lastMessage.timestamp > lastSeen && c.lastMessage.from.toLowerCase() !== address.toLowerCase()
      )
  );

  return { hasUnread };
}
