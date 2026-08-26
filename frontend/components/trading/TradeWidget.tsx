"use client";

import { useState } from "react";
import type { Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { userTokenAbi } from "@/lib/contracts";
import { useBondingCurve } from "@/hooks/useBondingCurve";
import { useTrading } from "@/hooks/useTrading";
import { formatUsdc, formatShareAmount } from "@/lib/format";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { ChainSwitch } from "@/components/wallet/ChainSwitch";
import { TransactionStatus } from "./TransactionStatus";

const SLIPPAGE_BPS = 200n; // 2% tolerance on top of the previewed quote

interface TradeWidgetProps {
  token: Address;
  /** Called after a trade confirms — lets the parent refetch data it owns
   *  (e.g. useUserToken's wagmi-cached price/supply) that this widget can't
   *  reach directly. */
  onTraded?: () => void;
}

export function TradeWidget({ token, onTraded }: TradeWidgetProps) {
  const { address, isConnected } = useAccount();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amountInput, setAmountInput] = useState("");
  const queryClient = useQueryClient();

  const { quoteBuy, quoteSell, isLoading: isCurveLoading, refetch: refetchCurve } = useBondingCurve(token);
  const { buy, sell, isWrongChain, usdcBalance, isApproving, isTrading, error, lastTxHash, reset } =
    useTrading(token);

  const shareBalanceQuery = useReadContract({
    address: token,
    abi: userTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const shareBalance = shareBalanceQuery.data as bigint | undefined;

  const amount = (() => {
    try {
      return amountInput ? BigInt(amountInput) : 0n;
    } catch {
      return 0n;
    }
  })();

  const quote = amount > 0n ? (side === "buy" ? quoteBuy(amount) : quoteSell(amount)) : undefined;
  const insufficientUsdc = side === "buy" && quote !== undefined && usdcBalance !== undefined && usdcBalance < quote;
  const insufficientShares = side === "sell" && shareBalance !== undefined && amount > shareBalance;

  async function handleSubmit() {
    if (amount <= 0n || quote === undefined) return;
    reset();
    try {
      if (side === "buy") {
        const maxCost = quote + (quote * SLIPPAGE_BPS) / 10_000n;
        await buy(amount, maxCost);
      } else {
        const minReturn = quote - (quote * SLIPPAGE_BPS) / 10_000n;
        await sell(amount, minReturn);
      }
      toast.success(side === "buy" ? "Purchase confirmed" : "Sale confirmed");
      setAmountInput("");
      await Promise.all([
        shareBalanceQuery.refetch(),
        refetchCurve(),
        // Price history/trade history/token stats are plain react-query
        // fetches keyed by this token — invalidating them here refreshes
        // every component reading them (PriceChart, TradeHistory, UserStats)
        // without threading refetch callbacks through each one.
        queryClient.invalidateQueries({
          predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[1] === token,
        }),
      ]);
      onTraded?.();
    } catch {
      toast.error(`Trade failed`);
    }
  }

  const isBusy = isApproving || isTrading;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <ChainSwitch />

      <div className="flex gap-1 rounded-full bg-surface-2 p-1">
        <button
          onClick={() => setSide("buy")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all ${
            side === "buy" ? "bg-success text-white shadow-md shadow-success/20" : "text-muted hover:text-foreground"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("sell")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all ${
            side === "sell" ? "bg-danger text-white shadow-md shadow-danger/20" : "text-muted hover:text-foreground"
          }`}
        >
          Sell
        </button>
      </div>

      <Input
        label="Amount (shares)"
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={amountInput}
        onChange={(e) => setAmountInput(e.target.value)}
        placeholder="0"
        hint={side === "sell" && shareBalance !== undefined ? `You own ${formatShareAmount(shareBalance)}` : undefined}
        error={
          insufficientUsdc
            ? "Insufficient USDC balance"
            : insufficientShares
              ? "You don't own that many shares"
              : undefined
        }
      />

      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm">
        <span className="text-muted">{side === "buy" ? "Total cost (incl. 3% fee)" : "You'll receive (after 3% fee)"}</span>
        <span className="font-semibold text-foreground">
          {isCurveLoading ? "…" : quote !== undefined ? `${formatUsdc(quote)} USDC` : "—"}
        </span>
      </div>

      {!isConnected ? (
        <p className="text-center text-sm text-muted">Connect your wallet to trade.</p>
      ) : (
        <Button
          variant={side === "buy" ? "success" : "danger"}
          onClick={handleSubmit}
          isLoading={isBusy}
          disabled={amount <= 0n || insufficientUsdc || insufficientShares || isWrongChain}
        >
          {isApproving ? "Approving USDC…" : isTrading ? "Confirming…" : side === "buy" ? "Buy shares" : "Sell shares"}
        </Button>
      )}

      <TransactionStatus hash={lastTxHash} isPending={isBusy} isSuccess={!isBusy && Boolean(lastTxHash) && !error} error={error} />
    </div>
  );
}
