import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getTokenStats, getUsernameForAddress } from "@/lib/onchain-data";
import { serializeBigInts } from "@/lib/api-utils";
import { withRedisCache } from "@/lib/server-cache";

export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const result = await withRedisCache(`user-info:${address.toLowerCase()}`, async () => {
    const user = await getUsernameForAddress(address);
    if (!user) return null;
    const stats = await getTokenStats(user.token);
    return { ...user, stats };
  });

  if (!result) {
    return NextResponse.json({ error: "User not registered" }, { status: 404 });
  }
  return NextResponse.json(serializeBigInts(result));
}
