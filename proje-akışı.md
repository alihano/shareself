# proje-akışı.md — ShareSelf Proje Akışı

Friend.Tech tarzı bir SocialFi platformu: kullanıcılar kayıt olduğunda kendi
adlarına bağlı bir ERC-20 token ("kişi hissesi") oluşur, bu token quadratic
bonding curve ile alınıp satılır, ve token sahipleri kilitli mesajlaşmaya
erişim satın alabilir.

## Kullanıcı Akışı (User Flow)

1. **Cüzdan Bağlama** — Kullanıcı siteye girer, "Connect Wallet" ile cüzdanını
   bağlar (RainbowKit). Yanlış ağdaysa Arc Testnet'e geçmesi istenir.
2. **Kayıt (Register)** — Kullanıcı adı seçer (3-20 karakter), şartları kabul
   eder, `SocialFiPlatform.registerUser(username)` çağrılır. Bu işlem:
   - Kullanıcıya özel yeni bir `UserToken` (ERC-20) kontratı/kaydı oluşturur.
   - Token arzının %10'unu kurucuya (creator) ön-mint eder.
   - `username <-> address` eşlemesini kaydeder.
3. **Dashboard (Portföy)** — Kullanıcı kendi token'ının fiyatını, holder
   sayısını, marketcap'ini, 24s hacmini ve 7 günlük fiyat grafiğini görür.
   Ayrıca sahip olduğu diğer token'ları (holdings) ve bunların güncel
   değerini görür.
4. **Keşfet (Explore)** — Tüm kullanıcı token'ları aranabilir/filtrelenebilir
   liste halinde gösterilir (fiyat, holder, hacim).
5. **Profil Sayfası (`/@username`)** — Ziyaretçi bir kullanıcının profiline
   girer, token istatistiklerini ve fiyat grafiğini görür. Buradan:
   - **Satın Alma**: USDC ile o kişinin token'ından alır (`buyToken`).
   - **Satış** (sadece kendi token'ı için, eğer sahipse): token'ı satar
     (`sellToken`).
   - **Mesajlaşma Kilidi**: 0.1 USDC ödeyerek o kişiyle DM açma hakkı satın
     alır (`unlockChat`), gelir %50 creator'a %50 platforma gider.
6. **Liderlik Tablosu (Leaderboard)** — En yüksek fiyat, en çok 24s hacim, en
   çok 7 günlük artış, en yeni kullanıcılar, en çok holder'a sahip
   kullanıcılar sıralanır.
7. **Mesajlar (Messages)** — Kilidi açılmış sohbetler listelenir, kullanıcı
   mesaj gönderip alabilir.

## Faz Akışı (Development Phases)

1. **Phase 1 — Smart Contracts**: `Errors.sol`, `BondingCurve.sol`,
   `UserToken.sol`, `SocialFiPlatform.sol`, `DirectMessaging.sol` +
   testler + deploy script. Arc Testnet'e deploy edilir.
2. **Phase 2 — Frontend Setup**: Next.js projesi, wagmi/viem/RainbowKit
   konfigürasyonu, Arc chain tanımı, kontrat adresleri/ABI'ler.
3. **Phase 3 — Pages & Components**: 7 sayfa (home, register, dashboard,
   explore, `[@username]`, leaderboard, messages), bileşenler, custom
   hook'lar, API route'ları.
4. **Phase 4 — Testing & Deployment**: Kontrat testleri, manuel testnet
   testi (faucet'ten USDC alma, kayıt, alım/satım, mesajlaşma), frontend
   build, Vercel'e deploy.

Detaylı adımlar için bkz. `geliştirme-adımları.md`; dosya/klasör düzeni için
bkz. `dosya-yapısı.md`; sabit kurallar için bkz. `train.md`.
