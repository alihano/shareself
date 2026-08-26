import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { socialFiPlatformAbi, userTokenAbi, SOCIALFI_PLATFORM_ADDRESS } from "@/lib/contracts";

/**
 * A registered user's on-chain snapshot: their share token, current supply,
 * marginal price, and username. Returns isRegistered: false (not an error)
 * when the address hasn't called registerUser yet.
 */
export function useUserToken(address?: Address) {
  const infoQuery = useReadContract({
    address: SOCIALFI_PLATFORM_ADDRESS,
    abi: socialFiPlatformAbi,
    functionName: "getUserInfo",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && SOCIALFI_PLATFORM_ADDRESS) },
  });

  const [token, totalSupply, currentPrice] = (infoQuery.data as [Address, bigint, bigint] | undefined) ?? [];

  const usernameQuery = useReadContract({
    address: token,
    abi: userTokenAbi,
    functionName: "username",
    query: { enabled: Boolean(token) },
  });

  const isRegistered = Boolean(token) && !infoQuery.isError;

  return {
    token,
    username: usernameQuery.data as string | undefined,
    totalSupply,
    currentPrice,
    isRegistered,
    isLoading: infoQuery.isLoading || usernameQuery.isLoading,
    refetch: infoQuery.refetch,
  };
}
