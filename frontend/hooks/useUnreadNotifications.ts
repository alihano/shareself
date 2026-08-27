import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useUserToken } from "./useUserToken";
import { useTokenActivity } from "./useTokenActivity";
import { ANNOUNCEMENTS } from "@/lib/announcements";
import { getLastSeenNotificationsAt } from "@/lib/read-state";

/**
 * True if there's a new announcement, or a new trade on the user's own
 * token (by someone else), since the last time they visited /notifications.
 * Shares its trade-history query key with app/notifications/page.tsx (both
 * go through useTokenActivity).
 */
export function useUnreadNotifications() {
  const { address } = useAccount();
  const { token } = useUserToken(address);
  const [lastSeen, setLastSeen] = useState(0);

  useEffect(() => {
    setLastSeen(getLastSeenNotificationsAt());
  }, []);

  const activityQuery = useTokenActivity(token);

  const hasUnreadAnnouncement = ANNOUNCEMENTS.some((a) => a.timestamp > lastSeen);
  const hasUnreadActivity = Boolean(
    address &&
      activityQuery.data?.some(
        (t) => t.timestamp > lastSeen && t.trader.toLowerCase() !== address.toLowerCase()
      )
  );

  return { hasUnread: hasUnreadAnnouncement || hasUnreadActivity };
}
