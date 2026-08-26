import { useState } from "react";
import type { Address } from "viem";
import { useAccount, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { arcTestnet } from "@/lib/arc-config";
import { publicClient } from "@/lib/viem-client";
import { SOCIALFI_PLATFORM_ADDRESS, USDC_ADDRESS, erc20Abi, socialFiPlatformAbi } from "@/lib/contracts";

/**
 * Buy/sell execution for a share token: handles the USDC approve step (only
 * when the existing allowance is insufficient), submits the trade, and waits
 * for both to be mined before resolving — so callers never race an
 * unconfirmed approval against the trade that depends on it.
 */
export function useTrading(token?: Address) {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [isApproving, setIsApproving] = useState(false);
  const [isTrading, setIsTrading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | undefined>();

  const isWrongChain = Boolean(chainId) && chainId !== arcTestnet.id;

  const balanceQuery = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && USDC_ADDRESS) },
  });

  const allowanceQuery = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, SOCIALFI_PLATFORM_ADDRESS] : undefined,
    query: { enabled: Boolean(address && USDC_ADDRESS && SOCIALFI_PLATFORM_ADDRESS) },
  });

  async function ensureAllowance(minAllowance: bigint) {
    const current = (allowanceQuery.data as bigint | undefined) ?? 0n;
    if (current >= minAllowance) return;

    setIsApproving(true);
    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [SOCIALFI_PLATFORM_ADDRESS, minAllowance],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await allowanceQuery.refetch();
    } finally {
      setIsApproving(false);
    }
  }

  async function switchToArc() {
    await switchChainAsync({ chainId: arcTestnet.id });
  }

  async function buy(amount: bigint, maxCost: bigint) {
    if (!token) throw new Error("No token to trade");
    setError(null);
    setIsTrading(true);
    try {
      await ensureAllowance(maxCost);
      const hash = await writeContractAsync({
        address: SOCIALFI_PLATFORM_ADDRESS,
        abi: socialFiPlatformAbi,
        functionName: "buyToken",
        args: [token, amount, maxCost],
      });
      setLastTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await Promise.all([balanceQuery.refetch(), allowanceQuery.refetch()]);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsTrading(false);
    }
  }

  async function sell(amount: bigint, minReturn: bigint) {
    if (!token) throw new Error("No token to trade");
    setError(null);
    setIsTrading(true);
    try {
      const hash = await writeContractAsync({
        address: SOCIALFI_PLATFORM_ADDRESS,
        abi: socialFiPlatformAbi,
        functionName: "sellToken",
        args: [token, amount, minReturn],
      });
      setLastTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await balanceQuery.refetch();
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsTrading(false);
    }
  }

  return {
    buy,
    sell,
    switchToArc,
    isWrongChain,
    usdcBalance: balanceQuery.data as bigint | undefined,
    isApproving,
    isTrading,
    error,
    lastTxHash,
    reset: () => setError(null),
  };
}
