"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAccount, useWriteContract } from "wagmi";
import toast from "react-hot-toast";
import { publicClient } from "@/lib/viem-client";
import { SOCIALFI_PLATFORM_ADDRESS, socialFiPlatformAbi } from "@/lib/contracts";
import { useUserToken } from "@/hooks/useUserToken";
import { Button } from "@/components/common/Button";
import { ChainSwitch } from "@/components/wallet/ChainSwitch";
import { TransactionStatus } from "@/components/trading/TransactionStatus";
import { XSignInButton } from "@/components/auth/XSignInButton";

export default function RegisterPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: session } = useSession();
  const { isRegistered, username: existingUsername } = useUserToken(address);
  const { writeContractAsync } = useWriteContract();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}`>();

  const xUsername = session?.user?.username;

  if (isRegistered) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface py-12 text-center">
        <p className="text-foreground">You&apos;re already registered as @{existingUsername}.</p>
        <Button className="mt-4" onClick={() => router.push(`/${existingUsername}`)}>
          Go to your profile
        </Button>
      </div>
    );
  }

  async function handleSubmit() {
    if (!xUsername) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const hash = await writeContractAsync({
        address: SOCIALFI_PLATFORM_ADDRESS,
        abi: socialFiPlatformAbi,
        functionName: "registerUser",
        args: [xUsername],
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success("Registered!");
      router.push(`/${xUsername}`);
    } catch (err) {
      setError(err as Error);
      toast.error("Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-12">
      <h1 className="text-2xl font-bold text-foreground">Register your profile</h1>
      <p className="text-sm text-muted">
        Connect your wallet and sign in with X — your X handle becomes your on-chain username. You can buy your own
        shares afterward, just like anyone else.
      </p>

      <ChainSwitch />

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">1. Wallet</span>
          {isConnected ? <span className="text-sm text-green-400">Connected ✓</span> : <span className="text-sm text-muted">Not connected</span>}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">2. X account</span>
          <XSignInButton />
        </div>
      </div>

      {!isConnected ? (
        <p className="text-center text-sm text-muted">Connect your wallet to continue.</p>
      ) : !xUsername ? (
        <p className="text-center text-sm text-muted">Sign in with X to continue.</p>
      ) : (
        <Button onClick={handleSubmit} isLoading={isSubmitting}>
          Register as @{xUsername}
        </Button>
      )}

      <TransactionStatus hash={txHash} isPending={isSubmitting} isSuccess={!isSubmitting && Boolean(txHash) && !error} error={error} />
    </div>
  );
}
