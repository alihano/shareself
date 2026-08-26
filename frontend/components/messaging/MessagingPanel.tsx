"use client";

import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { useMessaging } from "@/hooks/useMessaging";
import { ChatBubble } from "./ChatBubble";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import { Loading } from "@/components/common/Loading";
import { Avatar } from "@/components/common/Avatar";
import { shortenAddress } from "@/lib/format";

export function MessagingPanel({ counterpart }: { counterpart: Address }) {
  const { address: self } = useAccount();
  const { hasAccess, messages, isLoadingMessages, sendMessage, isSending } = useMessaging(counterpart);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!hasAccess) {
    return (
      <p className="p-6 text-center text-sm text-muted">
        Chat with {shortenAddress(counterpart)} isn&apos;t unlocked yet. Visit their profile to unlock it.
      </p>
    );
  }

  async function handleSend() {
    if (!text.trim()) return;
    try {
      await sendMessage(text.trim());
      setText("");
    } catch {
      toast.error("Failed to send message");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Avatar seed={counterpart} size="sm" />
        <span className="text-sm font-medium text-foreground">{shortenAddress(counterpart)}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoadingMessages ? (
          <Loading label="Loading messages…" />
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Say hello 👋</p>
        ) : (
          messages.map((message, i) => (
            <ChatBubble key={i} message={message} isOwn={message.from.toLowerCase() === self?.toLowerCase()} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-border p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message…"
          className="flex-1"
        />
        <Button onClick={handleSend} isLoading={isSending} disabled={!text.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
