import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getConversationsForUser } from "@/lib/messages-store";

// Not one of the six routes originally listed in geliştirme-adımları.md, but
// components/messaging/ConversationList.tsx (also spec'd) has no way to
// enumerate a user's conversations without it — lib/messages-store.ts is
// server-only (fs), so the client can't read it directly.
export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  return NextResponse.json(getConversationsForUser(address));
}
