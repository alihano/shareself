import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getPriceHistory } from "@/lib/onchain-data";
import { serializeBigInts } from "@/lib/api-utils";
import { withRedisCache } from "@/lib/server-cache";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || !isAddress(token)) {
    return NextResponse.json({ error: "Missing or invalid ?token=" }, { status: 400 });
  }

  const history = await withRedisCache(`price-history:${token.toLowerCase()}`, () => getPriceHistory(token));
  return NextResponse.json(serializeBigInts(history));
}
