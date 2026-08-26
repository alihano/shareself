import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getTokenStats } from "@/lib/onchain-data";
import { serializeBigInts } from "@/lib/api-utils";
import { withRedisCache } from "@/lib/server-cache";

export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const stats = await withRedisCache(`token-stats:${address.toLowerCase()}`, () => getTokenStats(address));
    return NextResponse.json(serializeBigInts(stats));
  } catch {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
}
