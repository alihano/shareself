import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getUserActivityFast } from "@/lib/onchain-data-fast";
import { serializeBigInts } from "@/lib/api-utils";

export async function GET(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const activity = await getUserActivityFast(address, limit);
  return NextResponse.json(serializeBigInts(activity));
}
