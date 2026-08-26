import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { getLastSeenMessagesAt } from "@/lib/read-state";

/**
 * True if someone sent a new message since the user last visited /messages.
 * Uses the content-free /api/messages/unread endpoint (no auth/signature
 * needed) rather than useConversations — this hook backs the navbar badge,
 * which is mounted on every page, so it must never prompt a wallet
 * signature just from being rendered.
 */
export function useUnreadMessages() {
  const { address } = useAccount();
  const [lastSeen, setLastSeen] = useState(0);

  useEffect(() => {
    setLastSeen(getLastSeenMessagesAt());
  }, []);

  const query = useQuery({
    queryKey: ["messages-unread", address, lastSeen],
    queryFn: async () =>
      (await axios.get<{ hasUnread: boolean }>(`/api/messages/unread/${address}`, { params: { since: lastSeen } }))
        .data,
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });

  return { hasUnread: Boolean(query.data?.hasUnread) };
}
