import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { hasChatAccess } from "@/lib/onchain-data";
import { appendMessage } from "@/lib/messages-store";

const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const from = body?.from as string | undefined;
  const to = body?.to as string | undefined;
  const text = body?.text as string | undefined;

  if (!from || !isAddress(from) || !to || !isAddress(to)) {
    return NextResponse.json({ error: "Invalid from/to address" }, { status: 400 });
  }
  if (!text || !text.trim() || text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Invalid message text" }, { status: 400 });
  }
  if (from.toLowerCase() === to.toLowerCase()) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
  }

  const allowed = await hasChatAccess(from as Address, to as Address);
  if (!allowed) {
    return NextResponse.json({ error: "Chat not unlocked between these addresses" }, { status: 403 });
  }

  appendMessage({ from: from as Address, to: to as Address, text: text.trim(), timestamp: Date.now() });
  return NextResponse.json({ ok: true }, { status: 201 });
}
