import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { userTokenAbi } from "@/lib/contracts";
import { getPrice, quoteBuy, quoteSell } from "@/lib/bonding-curve";

/**
 * Read-only bonding-curve pricing for a token's *current* on-chain supply.
 * Mirrors contracts/BondingCurve.sol locally (lib/bonding-curve.ts) so the UI
 * can preview a quote per keystroke without a round trip per keystroke; the
 * actual trade always re-quotes on-chain via SocialFiPlatform (see
 * useTrading), so a stale local mirror can never cause a bad trade.
 */
export function useBondingCurve(token?: Address) {
  const supplyQuery = useReadContract({
    address: token,
    abi: userTokenAbi,
    functionName: "totalSupply",
    query: { enabled: Boolean(token) },
  });

  const supply = supplyQuery.data as bigint | undefined;

  return {
    supply,
    currentPrice: supply !== undefined ? getPrice(supply) : undefined,
    quoteBuy: (amount: bigint) => (supply !== undefined ? quoteBuy(supply, amount) : undefined),
    quoteSell: (amount: bigint) => (supply !== undefined ? quoteSell(supply, amount) : undefined),
    isLoading: supplyQuery.isLoading,
    refetch: supplyQuery.refetch,
  };
}
