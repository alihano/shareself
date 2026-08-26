import { NextRequest, NextResponse } from "next/server";
import { type LeaderboardEntry } from "@/lib/onchain-data";
import { getLeaderboardFast } from "@/lib/onchain-data-fast";
import { serializeBigInts } from "@/lib/api-utils";

type SortBy = "price" | "volume24h" | "newest" | "holders";

function sortEntries(entries: LeaderboardEntry[], sortBy: SortBy): LeaderboardEntry[] {
  const sorted = [...entries];
  switch (sortBy) {
    case "volume24h":
      return sorted.sort((a, b) => (b.stats.volume24h > a.stats.volume24h ? 1 : -1));
    case "holders":
      return sorted.sort((a, b) => b.stats.holderCount - a.stats.holderCount);
    case "newest":
      // getAllRegisteredUsers() returns UserRegistered events in chronological
      // (ascending) block order — reverse it for newest-first.
      return sorted.reverse();
    case "price":
    default:
      return sorted.sort((a, b) => (b.stats.currentPrice > a.stats.currentPrice ? 1 : -1));
  }
}

export async function GET(request: NextRequest) {
  const sortByParam = request.nextUrl.searchParams.get("sortBy");
  const sortBy: SortBy = ["price", "volume24h", "newest", "holders"].includes(sortByParam ?? "")
    ? (sortByParam as SortBy)
    : "price";

  const entries = await getLeaderboardFast();
  const sorted = sortEntries(entries, sortBy);

  const rows = sorted.map((entry) => ({
    address: entry.address,
    username: entry.username,
    token: entry.token,
    totalSupply: entry.stats.totalSupply,
    currentPrice: entry.stats.currentPrice,
    holderCount: entry.stats.holderCount,
    volume24h: entry.stats.volume24h,
  }));

  return NextResponse.json(serializeBigInts(rows));
}
