"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { arcTestnet } from "@/lib/arc-config";

// WalletConnect Cloud project ID (required by RainbowKit's WalletConnect
// connector). Get a real one at https://cloud.reown.com and set it as
// NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in frontend/.env.local. The fallback
// below is NOT a real/functional ID — RainbowKit throws at both build and
// request time on an empty string, so a non-empty placeholder is required
// just to let the app build; WalletConnect connections won't work until a
// real project ID is set.
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_WALLETCONNECT_PROJECT_ID";

const wagmiConfig = getDefaultConfig({
  appName: "ShareSelf",
  projectId: walletConnectProjectId,
  chains: [arcTestnet],
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={darkTheme({
              accentColor: "#8b5cf6",
              accentColorForeground: "white",
              borderRadius: "large",
            })}
          >
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: { background: "#1a1a24", color: "#f5f5f7", border: "1px solid #26262f" },
              }}
            />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}
