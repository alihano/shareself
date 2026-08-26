"use client";

import Link from "next/link";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";

function Dot() {
  return (
    <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-danger ring-2 ring-background" />
  );
}

export function MessagesNavLink() {
  const { hasUnread } = useUnreadMessages();
  return (
    <Link href="/messages" className="relative transition-colors hover:text-foreground">
      Messages
      {hasUnread && <Dot />}
    </Link>
  );
}

export function NotificationsNavLink() {
  const { hasUnread } = useUnreadNotifications();
  return (
    <Link href="/notifications" className="relative transition-colors hover:text-foreground">
      Notifications
      {hasUnread && <Dot />}
    </Link>
  );
}
