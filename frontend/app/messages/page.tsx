"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { ConversationList } from "@/components/messaging/ConversationList";
import { MessagingPanel } from "@/components/messaging/MessagingPanel";
import { markMessagesSeenNow } from "@/lib/read-state";

function MessagesContent() {
  const { isConnected } = useAccount();
  const searchParams = useSearchParams();
  const initial = searchParams.get("with");
  const [selected, setSelected] = useState<Address | undefined>(
    initial && /^0x[a-fA-F0-9]{40}$/.test(initial) ? (initial as Address) : undefined
  );

  useEffect(() => {
    markMessagesSeenNow();
  }, []);

  if (!isConnected) {
    return <p className="py-12 text-center text-muted">Connect your wallet to see your messages.</p>;
  }

  return (
    <div className="grid h-[70vh] grid-cols-1 overflow-hidden rounded-2xl border border-border bg-surface md:grid-cols-3">
      <div className="border-b border-border md:col-span-1 md:border-b-0 md:border-r">
        <ConversationList selected={selected} onSelect={setSelected} />
      </div>
      <div className="md:col-span-2">
        {selected ? (
          <MessagingPanel counterpart={selected} />
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-muted">
            Select a conversation to start messaging.
          </p>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesContent />
    </Suspense>
  );
}
