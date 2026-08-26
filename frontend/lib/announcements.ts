// Platform-wide announcements. No admin UI/backend for this (train.md) — the
// site owner edits this array directly and redeploys to publish a new one.
// Keep entries newest-first.

export interface Announcement {
  id: string;
  title: string;
  body: string;
  timestamp: number; // ms, hardcode Date.UTC(...) so it's stable across builds
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "welcome",
    title: "Welcome to ShareSelf",
    body: "ShareSelf is live on Arc Testnet. Sign in with X, register your profile, and start trading shares — this is a testnet demo, tokens have no real-world value.",
    timestamp: Date.UTC(2026, 7, 25),
  },
];
