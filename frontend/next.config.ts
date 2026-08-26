import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Repo root has its own package-lock.json (Hardhat project) alongside
  // frontend/'s — pin the workspace root explicitly so Next.js/Turbopack
  // doesn't have to guess which one to use. Points at the repo root (one
  // level up), not frontend/ itself, because lib/contracts.ts imports ABI
  // JSON straight from the repo root's artifacts/ (see train.md) — pinning
  // to frontend/ would put that outside Turbopack's resolvable root.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
