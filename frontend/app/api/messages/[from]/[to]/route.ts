import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { hasChatAccess } from "@/lib/onchain-data";
import { getConversation } from "@/lib/messages-store";
import { verifyCallerSignature } from "@/lib/message-auth";

// hasChatAccess only proves *some* unlock happened between `from`/`to` — it
// says nothing about who is making this HTTP request. A signature proving
// the caller controls `from` or `to` (see lib/message-auth.ts) is required
// too, otherwise anyone who observes an unlock on-chain could read the
// conversation's full content without being either party.
export async function GET(request: NextRequest, { params }: { params: Promise<{ from: string; to: string }> }) {
  const { from, to } = await params;
  if (!isAddress(from) || !isAddress(to)) {
    return NextResponse.json({ error: "Invalid from/to address" }, { status: 400 });
  }

  const as = request.nextUrl.searchParams.get("as");
  const timestamp = Number(request.nextUrl.searchParams.get("timestamp"));
  const signature = request.nextUrl.searchParams.get("signature");
  const isParty = as?.toLowerCase() === from.toLowerCase() || as?.toLowerCase() === to.toLowerCase();
  if (!as || !isParty || !signature || !(await verifyCallerSignature(as as Address, timestamp, signature as `0x${string}`))) {
    return NextResponse.json({ error: "Invalid or missing signature, or caller isn't a party to this conversation" }, { status: 401 });
  }

  const allowed = await hasChatAccess(from as Address, to as Address);
  if (!allowed) {
    return NextResponse.json({ error: "Chat not unlocked between these addresses" }, { status: 403 });
  }

  return NextResponse.json(await getConversation(from as Address, to as Address));
}
