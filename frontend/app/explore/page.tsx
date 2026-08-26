"use client";

import { useMemo, useState } from "react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { UserCard } from "@/components/user/UserCard";
import { Input } from "@/components/common/Input";
import { Loading } from "@/components/common/Loading";

export default function ExplorePage() {
  const { rows, isLoading } = useLeaderboard("price");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => rows.filter((row) => row.username.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Explore</h1>
        <p className="text-sm text-muted">Browse every registered ShareSelf profile.</p>
      </div>

      <Input placeholder="Search by username…" value={search} onChange={(e) => setSearch(e.target.value)} />

      {isLoading ? (
        <Loading label="Loading users…" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">No users found.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => (
            <UserCard key={row.address} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
