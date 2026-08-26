"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

/**
 * Thin wrapper around RainbowKit's own ConnectButton, which already covers
 * two of train.md's required error states out of the box: "wallet not
 * connected" (shows a Connect Wallet button) and "wrong chain" (shows a
 * red Wrong Network button that switches on click) — no need to reimplement
 * either.
 */
export function WalletConnect() {
  return <ConnectButton showBalance={false} />;
}
