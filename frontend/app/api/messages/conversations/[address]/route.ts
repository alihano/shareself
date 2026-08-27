import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getConversationsForUser } from "@/lib/messages-store";
import { verifyCallerSignature } from "@/lib/message-auth";

// Not one of the six routes originally listed in geliştirme-adımları.md, but
// components/messaging/ConversationList.tsx (also spec'd) has no way to
// enumerate a user's conversations without it — lib/messages-store.ts is
// server-only (fs), so the client can't read it directly.
//
// Requires a signature proving the caller controls `address` (see
// lib/message-auth.ts) — this endpoint returns message *content*
// (lastMessage.text), so without this check anyone could read any
// registered user's conversation previews by guessing their address.
export async function GET(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const timestamp = Number(request.nextUrl.searchParams.get("timestamp"));
  const signature = request.nextUrl.searchParams.get("signature");
  if (!signature || !(await verifyCallerSignature(address, timestamp, signature as `0x${string}`))) {
    return NextResponse.json({ error: "Invalid or missing signature" }, { status: 401 });
  }

  return NextResponse.json(await getConversationsForUser(address));
}
