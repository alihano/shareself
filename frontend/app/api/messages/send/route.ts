import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { hasChatAccess } from "@/lib/onchain-data";
import { appendMessage } from "@/lib/messages-store";
import { verifyCallerSignature } from "@/lib/message-auth";

const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const from = body?.from as string | undefined;
  const to = body?.to as string | undefined;
  const text = body?.text as string | undefined;
  const timestamp = Number(body?.timestamp);
  const signature = body?.signature as `0x${string}` | undefined;

  if (!from || !isAddress(from) || !to || !isAddress(to)) {
    return NextResponse.json({ error: "Invalid from/to address" }, { status: 400 });
  }
  if (!text || !text.trim() || text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Invalid message text" }, { status: 400 });
  }
  if (from.toLowerCase() === to.toLowerCase()) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
  }
  // Signature proves the caller actually controls `from` — without this,
  // anyone with chat access between two addresses could post messages that
  // impersonate either party (see lib/message-auth.ts).
  if (!signature || !(await verifyCallerSignature(from as Address, timestamp, signature))) {
    return NextResponse.json({ error: "Invalid or missing signature" }, { status: 401 });
  }

  const allowed = await hasChatAccess(from as Address, to as Address);
  if (!allowed) {
    return NextResponse.json({ error: "Chat not unlocked between these addresses" }, { status: 403 });
  }

  appendMessage({ from: from as Address, to: to as Address, text: text.trim(), timestamp: Date.now() });
  return NextResponse.json({ ok: true }, { status: 201 });
}
