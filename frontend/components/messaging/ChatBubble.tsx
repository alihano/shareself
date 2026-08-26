import clsx from "clsx";
import type { StoredMessage } from "@/lib/messages-store";
import { formatRelativeTime } from "@/lib/format";

export function ChatBubble({ message, isOwn }: { message: StoredMessage; isOwn: boolean }) {
  return (
    <div className={clsx("flex flex-col", isOwn ? "items-end" : "items-start")}>
      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
          isOwn ? "bg-gradient-to-r from-accent to-accent-2 text-white" : "bg-surface-2 text-foreground"
        )}
      >
        {message.text}
      </div>
      <span className="mt-1 text-xs text-muted">{formatRelativeTime(message.timestamp)}</span>
    </div>
  );
}
