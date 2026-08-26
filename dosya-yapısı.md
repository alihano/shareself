# dosya-yapısı.md — Proje Dosya Yapısı

```
social project/
├── train.md                     # Sabit kurallar (bu proje boyunca referans)
├── proje-akışı.md                # Kullanıcı akışı + faz özetleri
├── geliştirme-adımları.md        # Faz bazlı yapılacaklar listesi
├── dosya-yapısı.md               # Bu dosya
├── README.md                     # Kurulum, deploy edilen adresler, canlı URL
├── .env.example                  # Placeholder env değişkenleri (secrets YOK)
├── .gitignore
│
├── contracts/                    # Solidity kontratları (Hardhat projesi)
│   ├── Errors.sol
│   ├── BondingCurve.sol
│   ├── UserToken.sol
│   ├── SocialFiPlatform.sol
│   ├── DirectMessaging.sol
│   └── mocks/                    # Sadece testler için (deploy edilmez)
│       ├── MockUSDC.sol
│       └── BondingCurveHarness.sol
│
├── test/                         # Hardhat testleri
│   ├── BondingCurve.test.ts
│   ├── SocialFiPlatform.test.ts
│   ├── UserToken.test.ts
│   └── DirectMessaging.test.ts
│
├── scripts/
│   └── deploy.ts                 # Arc Testnet deploy scripti
│
├── hardhat.config.ts
│
└── frontend/                     # Next.js uygulaması
    ├── .env.example               # Placeholder env değişkenleri (frontend)
    ├── .env.local                # (git-ignored) gerçek deploy adresleri
    ├── app/
    │   ├── layout.tsx
    │   ├── providers.tsx          # Wagmi + RainbowKit + React Query + Toaster
    │   ├── page.tsx               # Home
    │   ├── register/page.tsx
    │   ├── dashboard/page.tsx
    │   ├── explore/page.tsx
    │   ├── [username]/page.tsx    # Profil sayfası
    │   ├── leaderboard/page.tsx
    │   ├── messages/page.tsx
    │   ├── notifications/page.tsx  # Duyurular + "senin token'ın alınıp satıldı" bildirimleri
    │   └── api/
    │       ├── user/[address]/route.ts
    │       ├── token/[address]/route.ts
    │       ├── price-history/route.ts
    │       ├── leaderboard/route.ts
    │       ├── messages/
    │       │   ├── send/route.ts
    │       │   ├── [from]/[to]/route.ts
    │       │   └── conversations/[address]/route.ts  # ConversationList için ek route (bkz. train.md)
    │       └── auth/[...nextauth]/route.ts   # NextAuth — "Sign in with X" (bkz. train.md)
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Navbar.tsx
    │   │   ├── Footer.tsx
    │   │   └── Layout.tsx
    │   ├── wallet/
    │   │   ├── WalletConnect.tsx
    │   │   ├── ChainSwitch.tsx
    │   │   └── BalanceDisplay.tsx
    │   ├── trading/
    │   │   ├── TradeWidget.tsx
    │   │   ├── PriceChart.tsx
    │   │   ├── TransactionStatus.tsx
    │   │   └── TradeHistory.tsx
    │   ├── user/
    │   │   ├── UserCard.tsx
    │   │   ├── UserStats.tsx
    │   │   ├── UserProfile.tsx
    │   │   ├── PortfolioCard.tsx
    │   │   └── ActivityFeed.tsx       # Dashboard "Activity" — cüzdanın tüm alım/satımları
    │   ├── messaging/
    │   │   ├── MessagingPanel.tsx
    │   │   ├── ConversationList.tsx
    │   │   ├── ChatBubble.tsx
    │   │   └── UnlockChatButton.tsx
    │   ├── common/
    │   │   ├── Button.tsx
    │   │   ├── Input.tsx
    │   │   ├── Modal.tsx
    │   │   ├── Loading.tsx
    │   │   └── ErrorBoundary.tsx
    │   └── auth/
    │       └── XSignInButton.tsx      # "Sign in with X" — bkz. train.md
    │
    ├── hooks/
    │   ├── useUserToken.ts
    │   ├── useBondingCurve.ts
    │   ├── useTrading.ts
    │   ├── useMessaging.ts
    │   ├── usePriceHistory.ts
    │   └── useLeaderboard.ts
    │
    └── lib/
        ├── arc-config.ts          # Arc Testnet chain tanımı
        ├── viem-client.ts
        ├── contracts.ts           # Adresler + ABI'ler
        ├── bonding-curve.ts       # BondingCurve.sol'un JS/BigInt yansıması
        ├── format.ts              # USDC/adres/tarih formatlama yardımcıları
        ├── onchain-data.ts        # Event-log tabanlı leaderboard/price-history/holdings
        ├── messages-store.ts      # Dosya tabanlı DM içerik store'u (server-only)
        ├── api-utils.ts           # BigInt→string JSON serileştirme yardımcısı
        ├── auth.ts                # NextAuth config — "Sign in with X" (bkz. train.md)
        └── announcements.ts       # Statik duyuru listesi (admin UI yok, bkz. train.md)
```

Ayrıca `frontend/types/next-auth.d.ts` — NextAuth'un `Session`/`JWT` tiplerine
`username` alanını ekleyen modül augmentation dosyası.

Not: Yukarıdaki yapı Phase 1 (contracts/, test/, scripts/) ve Phase 2-3
(frontend/) sırasında adım adım doldurulacaktır; başlangıçta sadece iskelet
klasörler oluşturulur.
