# geliştirme-adımları.md — Faz Bazlı Geliştirme Adımları

## Phase 1: Smart Contracts

1. Hardhat projesi kur (`npm init -y`, `hardhat`, `@nomicfoundation/hardhat-toolbox`).
2. `contracts/Errors.sol` — tüm kontratlar için custom error tipleri
   (ör. `UserAlreadyRegistered`, `InvalidAmount`, `Unauthorized`, ...).
3. `contracts/BondingCurve.sol` — `getPrice(supply)`, `getBuyAmount(usdcAmount)`,
   `getSellAmount(tokenAmount)`; 6 decimal + overflow kontrolü.
4. `contracts/UserToken.sol` — ERC20 + Ownable, sadece platform mint/burn
   edebilir, %10 creator ön-mint.
5. `contracts/SocialFiPlatform.sol` — ana kontrolcü: `registerUser`,
   `buyToken`, `sellToken`, `getUserInfo`; %2 buy/sell fee; event'ler.
6. `contracts/DirectMessaging.sol` — `unlockChat` (0.1 USDC), `withdrawEarnings`,
   `hasAccessTo`; %50/%50 fee split.
7. Test dosyaları: `BondingCurve.test.ts`, `SocialFiPlatform.test.ts`,
   `UserToken.test.ts`, `DirectMessaging.test.ts`.
8. `scripts/deploy.ts` — sırayla deploy eder, adresleri `.env`'e yazar,
   explorer linklerini yazdırır.
9. Kontrol listesi: `npx hardhat compile` uyarısız, `npx hardhat test` tümü
   yeşil, decimal/overflow/access-control doğrulanmış.

## Phase 2: Frontend Setup

1. `npx create-next-app@latest frontend --typescript --tailwind --app`
2. Kütüphaneler: `viem`, `wagmi`, `@rainbow-me/rainbowkit`, `chart.js` +
   `react-chartjs-2`, `axios`, `react-hot-toast`, `zustand` (ops.), `clsx`.
3. `lib/arc-config.ts` — Arc Testnet chain tanımı (chain id, RPC, explorer,
   native currency).
4. `lib/viem-client.ts` — `createPublicClient`.
5. `lib/contracts.ts` — USDC/Platform/Messaging adresleri + ABI'ler
   (deploy sonrası doldurulur).
6. `app/providers.tsx` + `app/layout.tsx` — Wagmi + RainbowKit provider
   sarmalayıcı.
7. `.env.example` → `.env.local` kopyalanır, deploy edilen adreslerle
   doldurulur.
8. `npm run dev` ile hatasız açılış kontrolü.

## Phase 3: Pages & Components

1. Sayfalar: `app/page.tsx` (home), `app/register/page.tsx`,
   `app/dashboard/page.tsx`, `app/explore/page.tsx`,
   `app/[username]/page.tsx`, `app/leaderboard/page.tsx`,
   `app/messages/page.tsx`.
2. Bileşen grupları: `layout/`, `wallet/`, `trading/`, `user/`,
   `messaging/`, `common/`.
3. Custom hook'lar: `useUserToken`, `useBondingCurve`, `useTrading`,
   `useMessaging`, `usePriceHistory`, `useLeaderboard`.
4. API route'ları: `/api/user/[address]`, `/api/token/[address]`,
   `/api/price-history`, `/api/leaderboard`, `/api/messages/send`,
   `/api/messages/[from]/[to]`.
5. Hata durumları: yanlış chain, yetersiz USDC, tx pending/failed, cüzdan
   bağlı değil.
6. Responsive tasarım: mobile-first.
7. `npm run dev` ile tüm sayfalar test edilir, cüzdan bağlanır, Arc
   Testnet'e geçilir.

## Phase 4: Testing & Deployment

1. `npx hardhat test` → tüm kontrat testleri geçmeli.
2. `npm run build && npm run start` → frontend hatasız çalışmalı.
3. Manuel testnet testi: faucet'ten USDC al, kayıt ol, explorer'da token'ı
   kontrol et, alım/satım yap, portföyü kontrol et, mesajlaşma kilidini aç,
   leaderboard'u kontrol et.
4. Deploy: `npx hardhat run scripts/deploy.ts --network arcTestnet`,
   ardından frontend Vercel'e deploy edilir (env değişkenleri eklenerek).
5. `README.md` güncellenir: deploy edilen adresler, canlı URL, kurulum
   talimatları, ağ bilgileri, güvenlik/uyarı notu.
