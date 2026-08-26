"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { arcTestnet } from "@/lib/arc-config";
import { Button } from "@/components/common/Button";

/**
 * Inline "wrong network" banner for use inside a specific flow (e.g.
 * TradeWidget) where switching from RainbowKit's own header button isn't
 * obvious enough — renders nothing when already on Arc Testnet or when no
 * wallet is connected.
 */
export function ChainSwitch() {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === arcTestnet.id) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <span>You&apos;re on the wrong network. ShareSelf runs on Arc Testnet.</span>
      <Button
        variant="secondary"
        isLoading={isPending}
        onClick={() => switchChain({ chainId: arcTestnet.id })}
      >
        Switch network
      </Button>
    </div>
  );
}
