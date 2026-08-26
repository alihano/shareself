"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/common/Button";
import { Avatar } from "@/components/common/Avatar";

export function XSignInButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Button variant="secondary" disabled>
        Loading…
      </Button>
    );
  }

  if (session?.user?.username) {
    return (
      <div className="flex items-center gap-3 rounded-full border border-border bg-surface-2 py-1 pl-1.5 pr-3">
        <Avatar seed={session.user.username} imageUrl={session.user.image} size="sm" />
        <span className="text-sm text-foreground">
          @<span className="font-medium">{session.user.username}</span>
        </span>
        <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  return <Button onClick={() => signIn("twitter")}>Sign in with X</Button>;
}
