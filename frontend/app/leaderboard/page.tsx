"use client";

import { useState } from "react";
import clsx from "clsx";
import { useLeaderboard, type LeaderboardSort } from "@/hooks/useLeaderboard";
import { UserCard } from "@/components/user/UserCard";
import { Loading } from "@/components/common/Loading";

const SORT_OPTIONS: { value: LeaderboardSort; label: string }[] = [
  { value: "price", label: "Highest price" },
  { value: "volume24h", label: "24h volume" },
  { value: "holders", label: "Most holders" },
  { value: "newest", label: "Newest" },
];

export default function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<LeaderboardSort>("price");
  const { rows, isLoading } = useLeaderboard(sortBy);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>

      <div className="flex flex-wrap gap-2">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setSortBy(option.value)}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
              sortBy === option.value
                ? "bg-gradient-to-r from-accent to-accent-2 text-white shadow-md shadow-accent/20"
                : "border border-border bg-surface text-muted hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading label="Loading leaderboard…" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No registered users yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <li key={row.address} className="flex items-center gap-3">
              <span
                className={clsx(
                  "w-7 text-right text-sm font-bold",
                  i === 0 ? "text-amber-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-muted"
                )}
              >
                {i + 1}
              </span>
              <div className="flex-1">
                <UserCard row={row} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
