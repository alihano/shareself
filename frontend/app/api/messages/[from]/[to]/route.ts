import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { hasChatAccess } from "@/lib/onchain-data";
import { getConversation } from "@/lib/messages-store";

export async function GET(_request: Request, { params }: { params: Promise<{ from: string; to: string }> }) {
  const { from, to } = await params;
  if (!isAddress(from) || !isAddress(to)) {
    return NextResponse.json({ error: "Invalid from/to address" }, { status: 400 });
  }

  const allowed = await hasChatAccess(from as Address, to as Address);
  if (!allowed) {
    return NextResponse.json({ error: "Chat not unlocked between these addresses" }, { status: 403 });
  }

  return NextResponse.json(getConversation(from as Address, to as Address));
}
