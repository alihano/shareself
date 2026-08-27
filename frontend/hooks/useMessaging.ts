import { useState } from "react";
import type { Address } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { publicClient } from "@/lib/viem-client";
import { DIRECT_MESSAGING_ADDRESS, USDC_ADDRESS, directMessagingAbi, erc20Abi } from "@/lib/contracts";
import type { StoredMessage } from "@/lib/messages-store";
import { useMessageAuthToken } from "./useMessageAuthToken";

function conversationKey(a: Address, b: Address) {
  return ["messages", [a.toLowerCase(), b.toLowerCase()].sort().join(":")];
}

/**
 * Chat-unlock payment/access (on-chain, via DirectMessaging) plus message
 * content (off-chain, via /api/messages — see lib/messages-store.ts). A
 * conversation counts as unlocked if either side has paid to unlock the
 * other (train.md), so `hasAccess` ORs both directions.
 */
export function useMessaging(counterpart?: Address) {
  const { address: self } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { getToken } = useMessageAuthToken();
  const queryClient = useQueryClient();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const selfUnlockedQuery = useReadContract({
    address: DIRECT_MESSAGING_ADDRESS,
    abi: directMessagingAbi,
    functionName: "hasAccessTo",
    args: self && counterpart ? [self, counterpart] : undefined,
    query: { enabled: Boolean(self && counterpart && DIRECT_MESSAGING_ADDRESS) },
  });

  const counterpartUnlockedQuery = useReadContract({
    address: DIRECT_MESSAGING_ADDRESS,
    abi: directMessagingAbi,
    functionName: "hasAccessTo",
    args: self && counterpart ? [counterpart, self] : undefined,
    query: { enabled: Boolean(self && counterpart && DIRECT_MESSAGING_ADDRESS) },
  });

  const unlockFeeQuery = useReadContract({
    address: DIRECT_MESSAGING_ADDRESS,
    abi: directMessagingAbi,
    functionName: "UNLOCK_FEE",
    query: { enabled: Boolean(DIRECT_MESSAGING_ADDRESS) },
  });

  const earningsQuery = useReadContract({
    address: DIRECT_MESSAGING_ADDRESS,
    abi: directMessagingAbi,
    functionName: "earningsOf",
    args: self ? [self] : undefined,
    query: { enabled: Boolean(self && DIRECT_MESSAGING_ADDRESS) },
  });

  const hasAccess = Boolean(selfUnlockedQuery.data) || Boolean(counterpartUnlockedQuery.data);

  const messagesQuery = useQuery({
    queryKey: self && counterpart ? conversationKey(self, counterpart) : ["messages", "disabled"],
    queryFn: async () => {
      if (!self) throw new Error("Wallet not connected");
      const token = await getToken();
      if (!token) throw new Error("Wallet not connected");
      const res = await apiClient.get<StoredMessage[]>(`/api/messages/${self}/${counterpart}`, {
        params: { as: self, timestamp: token.timestamp, signature: token.signature },
      });
      return res.data;
    },
    enabled: Boolean(self && counterpart && hasAccess),
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!self || !counterpart) throw new Error("Wallet not connected");
      const token = await getToken();
      if (!token) throw new Error("Wallet not connected");
      await apiClient.post("/api/messages/send", {
        from: self,
        to: counterpart,
        text,
        timestamp: token.timestamp,
        signature: token.signature,
      });
    },
    onSuccess: () => {
      if (self && counterpart) queryClient.invalidateQueries({ queryKey: conversationKey(self, counterpart) });
    },
  });

  async function unlockChat() {
    if (!counterpart) return;
    const fee = (unlockFeeQuery.data as bigint | undefined) ?? 1_000_000n; // 1 USDC fallback, matches DirectMessaging.UNLOCK_FEE
    setError(null);
    setIsUnlocking(true);
    try {
      const approveHash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [DIRECT_MESSAGING_ADDRESS, fee],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const unlockHash = await writeContractAsync({
        address: DIRECT_MESSAGING_ADDRESS,
        abi: directMessagingAbi,
        functionName: "unlockChat",
        args: [counterpart],
      });
      await publicClient.waitForTransactionReceipt({ hash: unlockHash });
      await selfUnlockedQuery.refetch();
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsUnlocking(false);
    }
  }

  async function withdrawEarnings() {
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: DIRECT_MESSAGING_ADDRESS,
        abi: directMessagingAbi,
        functionName: "withdrawEarnings",
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await earningsQuery.refetch();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }

  return {
    hasAccess,
    unlockFee: unlockFeeQuery.data as bigint | undefined,
    earnings: earningsQuery.data as bigint | undefined,
    messages: messagesQuery.data ?? [],
    isLoadingMessages: messagesQuery.isLoading,
    sendMessage: (text: string) => sendMutation.mutateAsync(text),
    isSending: sendMutation.isPending,
    unlockChat,
    isUnlocking,
    withdrawEarnings,
    error,
  };
}
