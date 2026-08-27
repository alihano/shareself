import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getSafeLatestBlock, getTokenStatsFast, getUsernameForAddressFast } from "@/lib/onchain-data-fast";
import { serializeBigInts } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const latest = await getSafeLatestBlock();
  const user = await getUsernameForAddressFast(address, latest);
  if (!user) {
    return NextResponse.json({ error: "User not registered" }, { status: 404 });
  }

  const stats = await getTokenStatsFast(user.token, latest);
  return NextResponse.json(serializeBigInts({ ...user, stats }));
}
