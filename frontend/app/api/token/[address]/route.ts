import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getTokenStatsFast } from "@/lib/onchain-data-fast";
import { serializeBigInts } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const stats = await getTokenStatsFast(address);
    return NextResponse.json(serializeBigInts(stats));
  } catch {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
}
