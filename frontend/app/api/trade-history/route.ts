import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getTradeHistoryFast } from "@/lib/onchain-data-fast";
import { serializeBigInts } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || !isAddress(token)) {
    return NextResponse.json({ error: "Missing or invalid ?token=" }, { status: 400 });
  }
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const history = await getTradeHistoryFast(token, limit);
  return NextResponse.json(serializeBigInts(history));
}
