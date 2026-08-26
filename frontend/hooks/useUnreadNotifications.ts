import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useUserToken } from "./useUserToken";
import { getTradeHistory } from "@/lib/onchain-data";
import { ANNOUNCEMENTS } from "@/lib/announcements";
import { getLastSeenNotificationsAt } from "@/lib/read-state";

/**
 * True if there's a new announcement, or a new trade on the user's own
 * token (by someone else), since the last time they visited /notifications.
 * Shares its trade-history query key with app/notifications/page.tsx.
 */
export function useUnreadNotifications() {
  const { address } = useAccount();
  const { token } = useUserToken(address);
  const [lastSeen, setLastSeen] = useState(0);

  useEffect(() => {
    setLastSeen(getLastSeenNotificationsAt());
  }, []);

  const activityQuery = useQuery({
    queryKey: ["notifications-token-activity", token],
    queryFn: () => getTradeHistory(token!),
    enabled: Boolean(token),
    staleTime: 15_000,
  });

  const hasUnreadAnnouncement = ANNOUNCEMENTS.some((a) => a.timestamp > lastSeen);
  const hasUnreadActivity = Boolean(
    address &&
      activityQuery.data?.some(
        (t) => t.timestamp > lastSeen && t.trader.toLowerCase() !== address.toLowerCase()
      )
  );

  return { hasUnread: hasUnreadAnnouncement || hasUnreadActivity };
}
