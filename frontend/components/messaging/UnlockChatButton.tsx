"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useMessaging } from "@/hooks/useMessaging";
import { Button } from "@/components/common/Button";
import { formatUsdc } from "@/lib/format";

export function UnlockChatButton({ creator }: { creator: Address }) {
  const { isConnected } = useAccount();
  const router = useRouter();
  const { hasAccess, unlockFee, unlockChat, isUnlocking } = useMessaging(creator);

  if (!isConnected) return null;

  if (hasAccess) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm text-muted">Chat unlocked with this creator.</p>
        <Button variant="secondary" onClick={() => router.push(`/messages?with=${creator}`)}>
          Open chat
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm text-muted">
        Pay {unlockFee !== undefined ? formatUsdc(unlockFee) : "1"} USDC to unlock direct messaging with this
        creator (50% goes to them, 50% to the platform).
      </p>
      <Button
        isLoading={isUnlocking}
        onClick={async () => {
          try {
            await unlockChat();
            toast.success("Chat unlocked");
          } catch {
            toast.error("Failed to unlock chat");
          }
        }}
      >
        Unlock chat
      </Button>
    </div>
  );
}
