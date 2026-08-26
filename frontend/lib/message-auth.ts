import { recoverMessageAddress, type Address } from "viem";

// Signature-based proof of address ownership for the DM endpoints (see
// train.md — closes the "anyone can read anyone's private messages" gap:
// previously hasChatAccess() only checked whether *some* unlock existed
// between two addresses, never who was actually making the HTTP request).
// Isomorphic: recoverMessageAddress is pure crypto, no network/Node APIs, so
// this file is safe to import from both the client hook and server routes.

export const AUTH_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export function buildAuthMessage(address: Address | string, timestamp: number): string {
  return [
    "ShareSelf wants you to verify you control this wallet to access your messages.",
    "",
    `Address: ${address}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}

/** Verifies `signature` proves `claimedAddress` signed the auth message at `timestamp`, and that it hasn't expired. */
export async function verifyCallerSignature(
  claimedAddress: Address,
  timestamp: number,
  signature: `0x${string}`
): Promise<boolean> {
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > AUTH_MAX_AGE_MS) {
    return false;
  }
  try {
    const recovered = await recoverMessageAddress({
      message: buildAuthMessage(claimedAddress, timestamp),
      signature,
    });
    return recovered.toLowerCase() === claimedAddress.toLowerCase();
  } catch {
    return false;
  }
}
