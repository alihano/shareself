"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import clsx from "clsx";
import type { ConversationSummary } from "@/lib/messages-store";
import { shortenAddress, formatRelativeTime } from "@/lib/format";
import { Loading } from "@/components/common/Loading";
import { Avatar } from "@/components/common/Avatar";

interface ConversationListProps {
  selected?: Address;
  onSelect: (address: Address) => void;
}

export function ConversationList({ selected, onSelect }: ConversationListProps) {
  const { address } = useAccount();

  const query = useQuery({
    queryKey: ["conversations", address],
    queryFn: async () => (await axios.get<ConversationSummary[]>(`/api/messages/conversations/${address}`)).data,
    enabled: Boolean(address),
    refetchInterval: 10_000,
  });

  if (!address) return <p className="p-4 text-sm text-muted">Connect your wallet to see messages.</p>;
  if (query.isLoading) return <Loading label="Loading conversations…" />;
  if (!query.data || query.data.length === 0) {
    return <p className="p-4 text-sm text-muted">No conversations yet — unlock a chat from a profile.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {query.data.map((conversation) => (
        <li key={conversation.counterpart}>
          <button
            onClick={() => onSelect(conversation.counterpart)}
            className={clsx(
              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2",
              selected?.toLowerCase() === conversation.counterpart.toLowerCase() && "bg-surface-2"
            )}
          >
            <Avatar seed={conversation.counterpart} size="sm" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{shortenAddress(conversation.counterpart)}</span>
              <span className="line-clamp-1 text-xs text-muted">{conversation.lastMessage.text}</span>
              <span className="text-[11px] text-muted/70">{formatRelativeTime(conversation.lastMessage.timestamp)}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
