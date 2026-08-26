"use client";

import { useAccount, useReadContract } from "wagmi";
import { USDC_ADDRESS, erc20Abi } from "@/lib/contracts";
import { formatUsdc } from "@/lib/format";

const FAUCET_URL = "https://faucet.circle.com";

/** Connected wallet's USDC balance, with a faucet link when it's zero (train.md's "insufficient USDC" error state). */
export function BalanceDisplay() {
  const { address, isConnected } = useAccount();

  const balanceQuery = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && USDC_ADDRESS), refetchInterval: 15_000 },
  });

  if (!isConnected) return null;

  const balance = balanceQuery.data as bigint | undefined;
  const isEmpty = balance !== undefined && balance === 0n;

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
      <span className="text-muted">USDC</span>
      <span className="font-semibold text-foreground">{balance !== undefined ? formatUsdc(balance) : "…"}</span>
      {isEmpty && (
        <a
          href={FAUCET_URL}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline underline-offset-2 hover:text-accent-2"
        >
          Get testnet USDC
        </a>
      )}
    </div>
  );
}
