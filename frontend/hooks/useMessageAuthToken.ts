"use client";

import { useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { buildAuthMessage, AUTH_MAX_AGE_MS } from "@/lib/message-auth";

interface AuthToken {
  timestamp: number;
  signature: `0x${string}`;
}

// Module-level (not a ref) so every hook/component reading messages shares
// one cached signature per address for this browser tab, instead of each
// prompting MetaMask separately. In-flight dedup means two components
// requesting a token at the same moment before either has signed only
// trigger one signature prompt.
const tokenCache = new Map<string, AuthToken>();
const inFlight = new Map<string, Promise<AuthToken>>();

/**
 * Proves to the server that the connected wallet actually controls
 * `address`, for the DM read/send endpoints (see lib/message-auth.ts).
 * Signs once per ~9 minutes per address, not per request.
 */
export function useMessageAuthToken() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const getToken = useCallback(async (): Promise<AuthToken | null> => {
    if (!address) return null;
    const key = address.toLowerCase();

    const cached = tokenCache.get(key);
    if (cached && Date.now() - cached.timestamp < AUTH_MAX_AGE_MS - 60_000) {
      return cached;
    }

    const pending = inFlight.get(key);
    if (pending) return pending;

    const promise = (async () => {
      const timestamp = Date.now();
      const signature = await signMessageAsync({ message: buildAuthMessage(address, timestamp) });
      const token: AuthToken = { timestamp, signature };
      tokenCache.set(key, token);
      return token;
    })();

    inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      inFlight.delete(key);
    }
  }, [address, signMessageAsync]);

  return { getToken };
}
