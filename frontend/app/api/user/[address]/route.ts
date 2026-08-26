import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getTokenStats, getUsernameForAddress } from "@/lib/onchain-data";
import { serializeBigInts } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const user = await getUsernameForAddress(address);
  if (!user) {
    return NextResponse.json({ error: "User not registered" }, { status: 404 });
  }

  const stats = await getTokenStats(user.token);
  return NextResponse.json(serializeBigInts({ ...user, stats }));
}
