import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getPriceHistory } from "@/lib/onchain-data";
import { serializeBigInts } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || !isAddress(token)) {
    return NextResponse.json({ error: "Missing or invalid ?token=" }, { status: 400 });
  }

  const history = await getPriceHistory(token);
  return NextResponse.json(serializeBigInts(history));
}
