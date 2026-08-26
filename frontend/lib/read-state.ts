// Per-viewer "last seen" timestamps for the Messages/Notifications nav
// badges — localStorage only (no backend), same spirit as browser-storage
// UI conveniences elsewhere: it's fine if it's empty/reset in a new browser,
// it only gates a decorative unread dot, never real data access.

const MESSAGES_KEY = "shareself:lastSeenMessagesAt";
const NOTIFICATIONS_KEY = "shareself:lastSeenNotificationsAt";

function getLastSeen(key: string): number {
  try {
    return Number(localStorage.getItem(key) ?? 0);
  } catch {
    return 0;
  }
}

function setLastSeenNow(key: string) {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // ignore (private browsing, storage disabled, etc.)
  }
}

export const getLastSeenMessagesAt = () => getLastSeen(MESSAGES_KEY);
export const markMessagesSeenNow = () => setLastSeenNow(MESSAGES_KEY);

export const getLastSeenNotificationsAt = () => getLastSeen(NOTIFICATIONS_KEY);
export const markNotificationsSeenNow = () => setLastSeenNow(NOTIFICATIONS_KEY);
