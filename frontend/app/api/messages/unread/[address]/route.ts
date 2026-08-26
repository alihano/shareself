import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { hasNewMessagesSince } from "@/lib/messages-store";

// Deliberately unauthenticated — see hasNewMessagesSince's own doc comment.
// Only ever returns a boolean, never message content or the sender's
// address, so it's safe for the navbar badge to poll on every page without
// prompting a wallet signature just from being mounted.
export async function GET(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const since = Number(request.nextUrl.searchParams.get("since") ?? "0");
  return NextResponse.json({ hasUnread: hasNewMessagesSince(address, Number.isFinite(since) ? since : 0) });
}
