import { arcTestnet } from "@/lib/arc-config";

interface TransactionStatusProps {
  hash?: `0x${string}`;
  isPending?: boolean;
  isSuccess?: boolean;
  error?: Error | null;
}

/** Renders train.md's required "tx pending" / "tx failed" states; nothing when idle. */
export function TransactionStatus({ hash, isPending, isSuccess, error }: TransactionStatusProps) {
  if (error) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-red-300">
        Transaction failed: {error.message.slice(0, 200)}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Transaction pending…
      </div>
    );
  }

  if (isSuccess && hash) {
    return (
      <div className="rounded-xl border border-success/30 bg-success-bg px-3 py-2 text-sm text-green-300">
        Transaction confirmed —{" "}
        <a
          href={`${arcTestnet.blockExplorers.default.url}/tx/${hash}`}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          view on explorer
        </a>
      </div>
    );
  }

  return null;
}
