# train.md — Kritik Kurallar (ShareSelf / Arc Testnet SocialFi)

Bu dosya, projede kod yazan herhangi bir AI aracının (Claude Code dahil) her fazda
uyması gereken sabit kuralları listeler. Bu dosya boştu; içerik, projeyi başlatan
ana prompt'tan (ShareSelf Arc Builder) çıkarılmıştır ve proje ilerledikçe
güncellenmelidir.

## Ağ / Chain Bilgileri (Phase 4'te canlı ağa karşı DOĞRULANDI — 2026-08-25)
- Chain ID: `5042002` (Arc Testnet) — `eth_chainId` ile teyit edildi (`0x4cef52`).
- RPC: `https://rpc.testnet.arc.network` — canlı ve yanıt veriyor.
- Explorer: `https://testnet.arcscan.app` — adres sayfaları 200 dönüyor.
- Gas token: native gas 18 decimals (bakiye round bir sayı olarak geldi —
  tutarlı ama tam kanıt değil).
- ERC-20 USDC kontrat adresi: `0x3600000000000000000000000000000000000000`
  — zincirde gerçekten var, `symbol()` = "USDC", `decimals()` = 6, teyit
  edildi (native gas token'dan farklı, 18 decimal'lik gas'la karıştırılmamalı).
- Faucet: `https://faucet.circle.com`

> Bu değerler resmi Arc dokümantasyonuyla (`docs.arc.io/...`) karşılaştırılarak
> değil, doğrudan canlı ağa RPC çağrıları yapılarak doğrulandı (2026-08-25,
> gerçek Arc Testnet deploy'u sırasında). Deployer cüzdanı zaten fonluydu (20
> native gas + 20 ERC-20 USDC) — muhtemelen kullanıcı daha önce faucet'i
> kullanmış. Gerçek deploy edilen adresler için `README.md`'ye bakın.

## Decimal Kuralları
- Native gas USDC → 18 decimals → `parseUnits(amount, 18)`
- ERC-20 USDC (ödemeler, bonding curve, mesajlaşma ücreti) → 6 decimals →
  `parseUnits(amount, 6)`
- İki decimal sistemini asla karıştırma; her fonksiyonda hangi decimal
  kullanıldığını yorum/isimlendirme ile netleştir.

## Smart Contract Kuralları
- Bonding curve formülü: `price = (supply^2 * constant) / 10^18`
- `supply * supply` overflow'a karşı kontrol edilmeli (Solidity ^0.8 otomatik
  revert eder ama sınır durumları test edilmeli).
- Platform adresi: `0x3600000000000000000000000000000000000000` (ERC-20 USDC ile
  aynı — teyit edilmeli, aksi halde ayrı sabit olarak tutulmalı).
- Buy fee: %2, Sell fee: %2 (Phase 4 sonrası kullanıcı isteğiyle %3'e ve
  creator/platform split'e çıkarılıyor — bkz. aşağıdaki "Fee Değişiklikleri"
  notu, orijinal %2 burada sadece tarihi referans için duruyor).
- Chat unlock ücreti: ~~0.1 USDC (6 decimals → `1e5`)~~ → **1 USDC (`1e6`)**
  olarak güncellendi (kullanıcı isteği, bkz. "Fee Değişiklikleri"), %50
  creator / %50 platform split aynı kaldı.
- Custom error'lar (`Errors.sol`) kullan, `require(string)` kullanma (gas
  tasarrufu + okunabilirlik).
- Access control: sadece platform kontratı `UserToken.mint/burn` çağırabilir.
- Reentrancy: USDC transferi + state güncellemesi sırasına dikkat (checks-
  effects-interactions), gerekirse `ReentrancyGuard`.
- Private key KESİNLİKLE kaynak kodda veya git'e commit edilen dosyada olamaz.
  Sadece `.env` (git-ignored), `.env.example` sadece placeholder içerir.
- Her kontrat için test dosyası zorunlu; `npx hardhat compile` uyarısız
  geçmeli, `npx hardhat test` tüm testler yeşil olmalı.
- Sadece Arc Testnet'e deploy — mainnet/gerçek fon YOK.

## Frontend Kuralları
- Next.js (App Router) + TypeScript + TailwindCSS
- Wallet: wagmi + RainbowKit, RPC: viem
- Kontrat adresleri asla hardcode edilmez — `.env.local` üzerinden okunur.
- Zorunlu hata durumları: yanlış chain (Arc Testnet'e geç butonu), yetersiz
  USDC (faucet linki), işlem beklemede (spinner), işlem başarısız (toast).
- Mobile-first, responsive tasarım.
- UI'da regülasyon/uyarı metni (disclaimer) bulunmalı: bu bir testnet
  demosudur, gerçek finansal tavsiye değildir.

## Phase 1 Uygulama Kararları (SocialFiPlatform / DirectMessaging)
- **Reserve modeli**: `buyToken`'daki fiyatın fee hariç kısmı kontratta USDC
  reserve olarak kalır; `sellToken` bu reserve'den öder. Fee (%2) her işlemde
  anında `platformFeeRecipient`'a gönderilir, reserve'e hiç girmez — böylece
  reserve muhasebesi `BondingCurve.getBuyPrice`/`getSellPrice` ile simetrik
  kalır.
- **Slippage koruması**: `buyToken(token, amount, maxCost)` ve
  `sellToken(token, amount, minReturn)` — kullanıcı işlem gönderilmeden önce
  `quoteBuy`/`quoteSell` ile fiyatı görür, mempool'da fiyat kayarsa işlem
  otomatik revert eder (`CostExceedsMax` / `ReturnBelowMin`).
- **DirectMessaging earnings**: `unlockChat` sırasında creator payı anında
  gönderilmez, `earningsOf[creator]`'a eklenir ve `withdrawEarnings()` ile
  çekilir (pull pattern) — bir creator'ın alım yolu bozuk/reddedici olsa bile
  başka birinin `unlockChat` çağrısını bloklamaz.
- **Test mock'ları**: `contracts/mocks/MockUSDC.sol` (6 decimal test USDC'si)
  ve `contracts/mocks/BondingCurveHarness.sol` (kütüphanenin `internal`
  fonksiyonlarını teste açan wrapper) — sadece Hardhat testlerinde kullanılır,
  deploy script'i tarafından deploy edilmez (arcTestnet için gerçek USDC
  adresi kullanılır).
- Phase 1 kontrol listesi tamamlandı: `npx hardhat compile` uyarısız, `npx
  hardhat test` 47/47 yeşil.

## Phase 2 Uygulama Kararları (Frontend Setup)
- **npm install `--ignore-scripts`**: Kullanıcının global `~/.npmrc`'sinde
  `allow-scripts=@github/keytar,node-pty` allowlist'i var; bu, allowlist
  dışındaki paketlerin install script'lerini bloklar ve `create-next-app`'in
  kendi npm install'ı bu yüzden abort oldu. Kullanıcı global allowlist'i
  genişletmek yerine `--ignore-scripts` ile kurmayı seçti — `next dev`/`next
  build` için native postinstall script gerekmiyor, güvenli.
- **wagmi `^2.19` (v3 değil)**: npm registry kontrolünde görüldü ki en son
  `@rainbow-me/rainbowkit` (2.2.11) hâlâ `wagmi: ^2.9.0` peer dependency'sine
  sabitli — wagmi v3'ü desteklemiyor. `wagmi@latest` kurmak sessizce
  bozardı; wagmi 2.x'e sabitlendi.
- **ABI kaynağı**: `frontend/lib/contracts.ts`, SocialFiPlatform/
  DirectMessaging/UserToken ABI'lerini elle kopyalamak yerine doğrudan
  Hardhat'in derlediği `../../artifacts/contracts/*.sol/*.json`
  dosyalarından import eder — asla drift olmaz, ama frontend'i build etmeden
  önce repo kökünde `npx hardhat compile` çalışmış olmalı. USDC'nin ABI'si
  `contracts/mocks/MockUSDC.sol`'dan alınmaz (test-only); elle yazılmış
  minimal bir ERC-20 ABI subset'i kullanılır.
- **`scripts/deploy.ts` düzeltmesi**: Adresler artık root `.env`'e değil,
  `frontend/.env.local`'a `NEXT_PUBLIC_*` olarak yazılıyor (Next.js sadece
  kendi dizinindeki env dosyalarından `NEXT_PUBLIC_*` değişkenlerini inline
  eder). `DEPLOYER_PRIVATE_KEY` hiçbir zaman bu dosyaya yazılmaz.
- **`@x402/core` / `@x402/evm` / `@x402/svm`**: RainbowKit'in Coinbase Wallet
  connector'ı → `@coinbase/cdp-sdk` zincirinde bu üç paket opsiyonel peer
  dependency; kurulu olmayınca Turbopack build'i "Module not found" ile
  patlıyordu. Kendi kodumuzda kullanılmıyorlar — sadece build'in
  çözebilmesi için `frontend/package.json`'a eklendi.
- **WalletConnect projectId placeholder**: RainbowKit boş projectId'de hem
  build hem runtime'da atıyor. `app/providers.tsx`'te gerçek olmayan bir
  placeholder (`"YOUR_WALLETCONNECT_PROJECT_ID"`) fallback olarak var —
  sadece build'in geçmesi için; gerçek WalletConnect bağlantıları için
  `frontend/.env.local`'a `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
  (cloud.reown.com'dan alınır) girilmeli.
- **`next.config.ts` → `turbopack.root`**: Repo kökünde (Hardhat) ve
  `frontend/`'de iki ayrı `package-lock.json` var; Turbopack'in workspace
  root'u yanlış tahmin etmemesi için açıkça `frontend/` olarak sabitlendi.
- Phase 2 kontrol listesi tamamlandı: `npm run build` hatasız/uyarısız,
  `npm run dev` ile `/` 200 döndü (local Hardhat ağına deploy edilen
  adreslerle, `frontend/.env.local` üzerinden).

## Phase 3 Veri Mimarisi Kararları (kullanıcıya soruldu, onaylandı)
- **Mesaj içerikleri**: `DirectMessaging.sol` sadece ödeme/erişim hakkını
  (`hasAccessTo`) zincirde tutar, mesaj metinlerini tutmaz. Metinler
  `frontend/lib/messages-store.ts` üzerinden `frontend/.data/messages.json`'a
  (git-ignored) yazılır — basit, dosya tabanlı, ek servis/hesap gerektirmez.
  **Bilinen sınırlama**: Vercel gibi serverless ortamlarda dosya sistemi
  kalıcı değildir; Phase 4'te gerçek deploy öncesi bu store gerçek bir DB'ye
  (Vercel KV/Postgres vb.) taşınmalı. Ayrıca mesaj gönderimi şu an cüzdan
  imzasıyla doğrulanmıyor (`from` adresi client'tan geldiği gibi kabul
  ediliyor) — testnet demo kapsamında bilinçli bir basitleştirme, gerçek
  kullanıcı verisiyle prod'a çıkmadan önce SIWE/imza doğrulaması eklenmeli.
  Bir konuşma "unlocked" sayılır eğer `hasAccessTo[A][B]` VEYA
  `hasAccessTo[B][A]` true ise (taraflardan biri kilidi açtıysa iki yönlü
  mesajlaşabilirler).
- **Leaderboard/price-history/explore verisi**: Ayrı bir indexer/DB
  kurulmadı. `frontend/lib/onchain-data.ts`, `SocialFiPlatform`'un
  `UserRegistered`/`TokensBought`/`TokensSold` event log'larını viem
  `getContractEvents` ile tarayıp (DB'siz) hesaplıyor: kullanıcı listesi,
  fiyat geçmişi (her trade'in trade-sonrası supply'ından
  `frontend/lib/bonding-curve.ts`'teki formülle yerel olarak hesaplanıyor,
  RPC'ye tekrar sorulmuyor), 24s hacim, holder sayısı (Transfer event'lerinden
  toplanan adres kümesi + `balanceOf`). **Bilinen sınırlama**: kayıtlı
  kullanıcı sayısı arttıkça bu event-tarama yaklaşımı yavaşlar (RPC-ağır);
  testnet demo ölçeğinde kabul edilebilir, gerçek ölçekte ayrı bir indexer
  gerekir. `frontend/lib/bonding-curve.ts`'in `CURVE_CONSTANT`'ı
  `contracts/BondingCurve.sol`'daki ile elle senkron tutulmalı.

## Phase 3 Uygulama Notları (Pages & Components)
- **`UserToken.decimals()` düzeltmesi**: Phase 1'de gözden kaçmış bir hataydı
  — `UserToken` OZ ERC20'nin varsayılan 18 decimal'ini miras alıyordu, ama
  `BondingCurve`/`SocialFiPlatform` supply/amount'u her zaman ham tam sayı
  (whole share) olarak işliyor (ör. %10 premint = `100_000` ham birim, ondalık
  ölçekleme yok). `decimals()` artık `0` döndürüyor (override edildi) —
  aksi halde cüzdanlar/explorer'lar bakiyeleri `1e-18` ölçeğinde gösterirdi.
  Bu değişiklik yeniden compile + 47/47 test + yerel redeploy ile doğrulandı.
- **Trade history / holdings**: `geliştirme-adımları.md`'nin 6 route'luk
  listesinde yer almayan iki ek veri ihtiyacı client-side doğrudan
  `lib/onchain-data.ts` fonksiyonlarıyla (API route'suz, çünkü bu dosya `fs`
  kullanmıyor, tarayıcıda da çalışabiliyor) karşılandı:
  `getTradeHistory(token)` (TradeHistory bileşeni) ve
  `getHoldingsForAddress(address)` (Dashboard'daki portföy listesi).
- **Ek API route**: `/api/messages/conversations/[address]` — spesifikasyonda
  yoktu ama `ConversationList` bileşeni (o da spesifikasyonda var) bir
  kullanıcının tüm konuşmalarını listeleyebilmek için buna muhtaç;
  `lib/messages-store.ts` `fs` kullandığından client'tan doğrudan
  çağrılamıyor, bu yüzden ince bir route eklendi.
- **`turbopack.root` ince ayarı**: repo kökü (Hardhat) yerine `frontend/`'e
  sabitlemek, `lib/contracts.ts`'in kök `artifacts/`'a giden ABI import'larını
  kırdı (Turbopack root dışına çıkamıyor) — root artık repo köküne
  (`frontend/..`) sabitli, hem lockfile uyarısını susturuyor hem ABI
  import'larını çalışır tutuyor.
- **`tsconfig.json` `target`**: `ES2017` → `ES2020` yükseltildi — BigInt
  literal'leri (`0n`, `100_000n`) ES2020 altında derlenmiyor, kodun her yerinde
  (bonding-curve.ts, onchain-data.ts, hooks) yoğun şekilde kullanılıyor.
- **Golden-path doğrulama**: local bağımsız bir `npx hardhat node` +
  `--network localhost` deploy + iki kullanıcı kaydı/alım-satım/chat-unlock
  seed script'iyle gerçek zincir verisi üretilip, `npm run dev` çalışırken
  `/api/leaderboard`, `/api/user/[address]`, `/api/token/[address]`,
  `/api/price-history`, `/api/messages/send` (yetkili + yetkisiz gönderici),
  `/api/messages/[from]/[to]`, `/api/messages/conversations/[address]` ve
  `/explore`, `/leaderboard`, `/[username]` (var olan + olmayan kullanıcı),
  `/register`, `/dashboard`, `/messages` sayfaları curl ile gerçek veriyle test
  edildi — hepsi beklenen sonuçları verdi. Test sonrası seed script'i,
  `.data/messages.json` ve geçici `NEXT_PUBLIC_ARC_TESTNET_RPC_URL` override'ı
  temizlendi, `frontend/.env.local` normal ephemeral-hardhat adreslerine
  sıfırlandı.
- Phase 3 kontrol listesi tamamlandı: `npm run build` hatasız (7 sayfa + 7 API
  route derlendi), kontrat testleri hâlâ 47/47 yeşil.
- **Tarayıcı görsel testi** (claude-in-chrome, seed'lenmiş local zincire karşı):
  home/explore/leaderboard/`@alice` profili/register/dashboard/messages
  gerçek tarayıcıda kontrol edildi — gerçek veri doğru render oluyor (fiyat
  grafiği, trade history, leaderboard sıralaması), RainbowKit "Cüzdanı Bağla"
  modalı açılıyor (yerelleştirme İngilizce/Türkçe arasında tutarsız
  görünüyor — RainbowKit'in kendi dil algılama davranışı, kod tarafında bir
  hata değil), TradeWidget'taki canlı fiyat teklifi (`quoteBuy`) cüzdan
  bağlanmadan da doğru hesaplanıyor. Konsol hatası yok. Hiçbir gerçek uygulama
  hatası bulunmadı. `resize_window` bu ortamda tarayıcı penceresini gerçekten
  daraltmadı (`window.innerWidth` sabit kaldı) — dar viewport'ta gerçek
  piksel doğrulaması yapılamadı, mobile-first Tailwind class'larına
  (flex-wrap, grid responsive breakpoint'leri) güvenilerek bırakıldı.

## Phase 4 İlerleme Notu
- `npx hardhat test` (47/47) ve `cd frontend && npm run build && npm run start`
  tekrar doğrulandı (production sunucu `/`, `/explore`, `/register` için 200
  döndü) — bunlar kimlik bilgisi gerektirmediği için doğrudan yapıldı.
- Kök `README.md` oluşturuldu (kurulum, ağ bilgileri, güvenlik notu, bilinen
  sınırlamalar) — deploy edilen adresler/canlı URL alanları gerçek Arc
  Testnet deploy'u yapılınca doldurulacak (şu an placeholder).
- **Bilinçli olarak yapılMADI** (kullanıcının kendi cüzdanı/hesabı gerektirir,
  private key asla bu oturuma girilmemeli): gerçek Arc Testnet'e deploy,
  manuel testnet testi (faucet/kayıt/alım-satım/mesajlaşma), Vercel'e deploy.
  Bunlar için kullanıcıyla nasıl ilerlenmek istendiği konuşulacak.
- **Vercel haz��rlığı** (deploy edilmedi, sadece README'ye yazıldı):
  `frontend/lib/contracts.ts`'in `artifacts/`'a bağımlılığı yüzünden Vercel'in
  Root Directory ayarında "include files outside the root directory"
  açılmalı ve Build Command `hardhat compile`'ı da içerecek şekilde
  override edilmeli. Daha kritik: **mesajlaşma Vercel'de olduğu gibi
  çalışmaz** — `messages-store.ts` `process.cwd()`'ye yazıyor ama Vercel'in
  serverless dosya sistemi salt-okunur; mesaj göndermek 500 hatası verir
  (sadece veri kaybı değil). Gerçek kullanıcıya açık bir Vercel deploy'undan
  önce bu store gerçek bir DB'ye taşınmalı.

## X (Twitter) ile Kayıt (Phase 4 sırasında kullanıcı isteğiyle eklendi)
- Kullanıcı iste��i: Arena benzeri SocialFi uygulamaları gibi, kayıt serbest
  metin kullanıcı adı yerine **X hesabıyla giriş** üzerinden olsun; X handle
  otomatik olarak zincirdeki kullanıcı adı olsun, profilde X hesabına link
  görünsün.
- **Uygulama**: `next-auth@4.24.15` (App Router route: `app/api/auth/
  [...nextauth]/route.ts`, config: `frontend/lib/auth.ts`) ile "Sign in with
  X" (OAuth 2.0, `TwitterProvider({ version: "2.0" })`). Sadece
  `users.read tweet.read` scope'u istenir — `offline.access` (refresh token)
  istenmez, çünkü X API'sine giriş sonrası tekrar istek atılmıyor, sadece
  handle bir kere okunuyor.
- **Kontrat değişikliği YOK**: `SocialFiPlatform.registerUser(username)`
  aynen kullanılıyor — X OAuth sadece "bu adres gerçekten bu X hesabının
  sahibi" doğrulamasını yapıyor, `/register` sayfası doğrulanan handle'ı
  `username` argümanı olarak gönderiyor. X handle formatı (4-15 karakter,
  harf/rakam/alt çizgi) zaten kontratın 3-20 karakter kısıtına uyuyor.
- **Off-chain state yok**: NextAuth JWT session stratejisi kullanılıyor (veritabanı
  gerekmez) — "şu an bu tarayıcıda hangi X hesabıyla giriş yapılmış" bilgisi
  sadece imzalı bir cookie'de tutulur; kayıt tamamlandıktan sonra zincirdeki
  `username` tek doğru kaynak olur.
- **Bilinen sınırlama**: X handle'ı değiştirilirse (kullanıcı adını X'te
  değiştirirse) zincirdeki kayıtlı `username` eski haliyle kalır — otomatik
  resenkron yok, bilinçli bir basitleştirme (Arena gibi uygulamalar da
  genelde kayıt anındaki handle'ı snapshot alır).
- **Gerekli env değişkenleri** (`frontend/.env.local`, `.env.example`'da
  şablonu var): `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (lokal olarak rastgele
  üretildi, üçüncü taraf kimlik bilgisi değil), `AUTH_TWITTER_ID`,
  `AUTH_TWITTER_SECRET` (kullanıcının kendi X Developer Portal OAuth 2.0
  app'inden — **private key'de olduğu gibi bu session'a hiç yapıştırılmadı**,
  kullanıcı kendi `.env.local`'ına yazacak). Callback URL (X app ayarlarında
  girilmesi gereken): local için `http://localhost:3000/api/auth/callback/
  twitter`, prod/Vercel için `https://<domain>/api/auth/callback/twitter`.

## Dashboard "Wallet"/"Activity" ve Bildirimler (kullanıcı isteğiyle, Phase 4 sonrası)
- **Dashboard "Wallet"**: zaten var olan holdings listesi (bkz. `getHoldingsForAddress`)
  "Wallet" başlığı altında toplam portföy değeriyle (`Σ balance × currentPrice`)
  birlikte gösteriliyor — yeni veri kaynağı gerekmedi.
- **Dashboard "Activity"**: `lib/onchain-data.ts`'e `getUserActivity(address)`
  eklendi — `TokensBought`/`TokensSold` event'lerini `buyer`/`seller` indexed
  argümanlarıyla doğrudan filtreleyerek (tüm token'ları tek tek taramadan)
  bir cüzdanın TÜM token'lardaki alım/satım geçmişini getiriyor.
  `components/user/ActivityFeed.tsx` bunu render ediyor.
- **Bildirimler (`/notifications`, navbar'da "Messages" yanında)**: iki bölüm
  birleştiriliyor:
  1. **Duyurular** — `lib/announcements.ts`'teki statik dizi. **Admin paneli
     yok**: yeni bir duyuru yayınlamak için bu dosya elle düzenlenip
     yeniden deploy edilmeli. Bilinçli bir basitleştirme (auth'lu bir CRUD
     admin UI kurmak bu iste��in kapsamını ciddi genişletirdi).
  2. **"Your token activity"** — kullanıcının kendi token'ının
     alınıp/satılması bildirimleri; zaten var olan `getTradeHistory(token)`
     kendi token'ları için çağrılarak elde ediliyor, ek bir veri kaynağı
     gerekmedi. Okundu/okunmadı durumu veya push bildirim yok — sadece
     ters-kronolojik bir liste.

## Arc Testnet RPC Rate Limit Düzeltmesi (Phase 4, gerçek kullanım sırasında bulundu)
Kullanıcı gerçek deploy'da `/alihano` profiline girince "Request exceeds
defined limit... rate limit exceeded" hatası aldı (viem `LimitExceededRpcError`,
code -32005). İki ayrı kök sebep bulundu ve ikisi de düzeltildi:

1. **`fromBlock: 0n` her yerde kullanılıyordu** — kontrat block
   `58,836,046`'da deploy edildi ama zincir o an block `58,847,863`'teydi;
   yani her `eth_getLogs` çağrısı 58+ milyon boş bloğu tarıyordu. Çözüm:
   `scripts/deploy.ts` artık deploy transaction'ının block numarasını da
   `NEXT_PUBLIC_DEPLOY_BLOCK` olarak `frontend/.env.local`'a yazıyor;
   `lib/contracts.ts`'teki `DEPLOY_BLOCK` sabiti tüm `fromBlock: 0n`
   kullanımlarının yerini aldı (`lib/onchain-data.ts`).
2. **Asıl sebep bu değildi** — tek başına 20.000 bloklık bir `eth_getLogs`
   isteği sorunsuz çalıştı, yani Arc'ın RPC'si blok aralığını değil
   **eşzamanlı istek sayısını** sınırlıyor. Uygulama `Promise.all` ile
   birden fazla `eth_getLogs`'u aynı anda gönderiyordu (ör. bir profil
   sayfası aynı token için 3 farklı yerden log çekiyordu). Çözüm:
   `frontend/lib/rpc-throttle.ts` — tüm `getContractEvents` çağrılarını
   global bir kuyruktan tek tek, aralarında 350ms boşlukla geçiren bir
   throttle. `lib/onchain-data.ts`'teki her `getContractEvents` çağrısı artık
   bunun içinden geçiyor. `lib/viem-client.ts`'teki retry ayarları (3 deneme,
   750ms) artık sadece yedek güvenlik ağı, asıl çözüm throttle.
3. Ayrıca zaten var olan `cached()` (20s TTL + in-flight dedup) bu ikisiyle
   birlikte çalışıyor — aynı token için aynı anda gelen istekler tek bir
   gerçek RPC çağrısına iniyor.

**Doğrulama**: dev server'ı sıfırdan başlatıp `/api/leaderboard`,
`/api/token/[address]`, `/api/price-history`, `/alihano` profil sayfası tek
tek test edildi — hepsi 200, 0.1-2.4 saniye arası.

## Curve Tuning (kullanıcı isteğiyle: "artış/düşüş oranları çok düşük")
- **Kök sebep**: Karesel curve'de (`fiyat = arz² × sabit`) fiyatın yüzdesel
  esnekliği sabittir (~2× arz yüzdesel değişimi) — `CURVE_CONSTANT`'ı
  büyütüp küçültmek sadece fiyatın mutlak dolar seviyesini değiştirir,
  yüzdesel oynaklığı değiştirmez. Asıl kaldıraç: bir işlemin arzın ne kadarını
  oluşturduğu. Eski `CREATOR_PREMINT_BASIS=1_000_000` (100.000 pay premint)
  ile 400 pay almak arzın sadece %0.4'üydü → fiyat sadece %0.8 hareket
  ediyordu.
- **Değişiklik**: `CREATOR_PREMINT_BASIS` `1_000_000` → `10_000` (premint
  100.000 → 1.000 pay), `BondingCurve.CURVE_CONSTANT` `1e14` → `1e18` (ikisi
  birlikte kayıt-anı fiyatını hâlâ $1'de sabit tutuyor). Sonuç: 40 pay almak
  artık fiyatı ~%8.16 hareket ettiriyor (eskiden 400 pay için ~%0.8).
- **Senkron tutulması gereken 4 yer** (elle, otomatik değil):
  `contracts/BondingCurve.sol` (`CURVE_CONSTANT`),
  `contracts/SocialFiPlatform.sol` (`CREATOR_PREMINT_BASIS`),
  `frontend/lib/bonding-curve.ts` (JS/BigInt yansıması — zaten var olan bir
  senkron sorumluluğuydu), `test/BondingCurve.test.ts` ve
  `test/SocialFiPlatform.test.ts`'teki hardcoded `10n ** 14n` değerleri.
- **Bu bir kontrat değişikliği** — Arc Testnet'e yeniden deploy gerektirir,
  bu da önceki tüm kayıtları (kullanıcının `alihano` kaydı dahil) sıfırlar.
  Kullanıcı bunu zaten "başka bir cüzdanla test edeceğim" kararıyla kabul
  etmişti (bkz. yukarıki "kullanıcı adı sorunu" notu).

## Alım/Satım Sonrası Grafik Güncellenmiyordu (kullanıcı bulgusu)
İki ayrı sebep vardı:
1. **Client-side**: `buy`/`sell` başarılı olduktan sonra hiçbir yerde
   `PriceChart`/`TradeHistory`/`UserStats`'ın kullandığı react-query
   sorgularını (`["price-history", token]`, `["trade-history", token]`,
   `["token-stats", token]`) veya `useUserToken`'ın wagmi
   `useReadContract`'ını (ayrı bir cache, react-query invalidation'ı
   etkilemiyor) "bayat" işaretleyen bir şey yoktu.
2. **Server-side**: rate-limit düzeltmesi için eklenen `cached()` (20s TTL)
   işlemden hemen sonra bile eski veriyi döndürebiliyordu.

**Çözüm**: `TradeWidget.tsx` artık başarılı bir trade sonrası
`queryClient.invalidateQueries({ predicate: q => q.queryKey[1] === token })`
ile o token'a ait tüm react-query sorgularını tek seferde invalidate ediyor
(hangi bileşenin mount ettiğinden bağımsız — aynı `QueryClientProvider`
ağacında olduğu için hepsi yakalanıyor), artı `useBondingCurve`'ün wagmi
refetch'ini çağırıyor. Yeni bir `onTraded` prop'u parent'ın (`UserProfile.tsx`)
kendi `useUserToken` wagmi cache'ini refetch etmesini sağlıyor (TradeWidget
oraya doğrudan erişemiyor). `CACHE_TTL_MS` de 20s'den 5s'ye indirildi —
rate-limit'i önlemek için hâlâ yeterli (aynı sayfa yüklemesindeki eşzamanlı
istekler milisaniyeler içinde oluyor) ama işlem sonrası gecikmeyi
kısaltıyor.

## Fee Değişiklikleri (kullanıcı isteğiyle)
- **Buy/sell fee**: `%2` → `%3` (`BUY_FEE_BPS`/`SELL_FEE_BPS` = 300).
  Artık tamamı platforma gitmiyor — **%1.5 (fee'nin yarısı) token'ın
  creator'ına**, kalan **%1.5 platforma** gidiyor.
  `SocialFiPlatform.sol`'a yeni bir `CREATOR_FEE_SHARE_BPS = 5_000` (%50)
  sabiti ve `_distributeFee(token, fee)` private fonksiyonu eklendi;
  `creatorOfToken[token]`'a doğrudan `safeTransfer` ile gönderiliyor
  (DirectMessaging'deki gibi pull/accrue pattern değil — düz ERC20
  transfer'in alıcıya geri çağrı yapmadığı için reentrancy/DoS riski yok,
  push yeterli).
- **DM unlock ücreti**: `0.1 USDC` → `1 USDC` (`DirectMessaging.UNLOCK_FEE`
  `1e5` → `1e6`). %50/%50 creator/platform split aynı kaldı.
- Senkron tutulan test dosyaları: `test/SocialFiPlatform.test.ts` (fee %3 +
  creator/platform split assertion'ları), `test/DirectMessaging.test.ts`
  (`UNLOCK_FEE` sabiti). Frontend'de `TradeWidget.tsx`'teki "incl. 2% fee"
  metni "3%" olarak güncellendi.
- **Platform hazine cüzdanı**: kullanıcı ayrı bir `platformFeeRecipient`
  adresi verecek (henüz iletilmedi) — bu değişiklikle birlikte tek bir
  redeploy'da Arc Testnet'e gönderilecek.

## Navbar Bildirim Rozeti (kullanıcı isteğiyle)
"Messages" ve "Notifications" menü öğelerinde, okunmamış içerik varsa küçük
kırmızı bir nokta gösteriliyor. Backend/DB gerekmedi — `frontend/lib/
read-state.ts` her ikisi için "son görülme zamanı"nı sadece **localStorage**'da
tutuyor (kullanıcıya özel, cihaza özel; başka bir tarayıcıda/gizli modda
sıfırdan başlar — kritik veri değil, sadece dekoratif bir rozet). Sayfayı
ziyaret edince (`app/messages/page.tsx`, `app/notifications/page.tsx`)
zaman damgası güncelleniyor. `hooks/useUnreadMessages.ts` ve
`hooks/useUnreadNotifications.ts`, ilgili sayfaların zaten kullandığı
react-query key'lerini (`["conversations", address]`,
`["notifications-token-activity", token]`) paylaşıyor — rozet için ekstra
network isteği yok.

## Güvenlik Açığı Düzeltmesi: Yetkisiz DM Okuma (security-review ile bulundu)
`/security-review` çalıştırıldı (git yoktu, geçici bir yerel bare repo +
boş baseline commit kurulup gerçek "pending changes" diff'i oluşturuldu).
İki HIGH-severity, 9/10 güvenle doğrulanmış bulgu çıktı: hem
`/api/messages/conversations/[address]` hem `/api/messages/[from]/[to]`
route'ları **hiçbir kimlik doğrulaması yapmadan** özel mesaj içeriğini
döndürüyordu — `hasChatAccess` sadece "bu iki adres arasında bir unlock
var mı" diye bakıyordu, isteği KİMİN yaptığını hiç sormuyordu. Herhangi biri,
kayıtlı kullanıcıları enumerate edip başka birinin tüm özel yazışmalarını
okuyabilirdi.

**Çözüm — cüzdan imzasıyla kimlik kanıtı:**
- `frontend/lib/message-auth.ts`: `buildAuthMessage(address, timestamp)` +
  `verifyCallerSignature()` (viem `recoverMessageAddress`, izomorfik —
  network gerektirmez). İmza 10 dakika geçerli.
- `frontend/hooks/useMessageAuthToken.ts`: `wagmi useSignMessage` ile bir kez
  imzalatıp **modül seviyesinde** (component ref değil) adrese göre
  önbellekliyor — aynı sekmede kaç bileşen kullanırsa kullansın tek imza
  isteği çıkıyor, in-flight dedup ile eşzamanlı çağrılar da tek promise'i
  paylaşıyor.
- Düzeltilen route'lar: `messages/conversations/[address]` (artık
  `?timestamp=&signature=` zorunlu, çağıranın gerçekten o adres olduğunu
  kanıtlaması gerekiyor), `messages/[from]/[to]` (artık `?as=&timestamp=&
  signature=` — `as`, `from` veya `to`'dan biri olmalı VE imzalanmalı),
  `messages/send` (POST body'de `timestamp`/`signature` — `from` artık
  taklit edilemiyor, security-review'ün Vuln 3 olarak işaretleyip
  "zaten bilinen/kabul edilmiş sınırlama" diye elediği spoofing açığı da
  bu arada kapandı).
- **Navbar rozeti için özel çözüm**: `useUnreadMessages` (her sayfada
  mount olan navbar'da) yukarıdaki imzalı akışı KULLANMIYOR — onu kullansaydı
  kullanıcı siteye her girişte (Messages'a hiç girmeden) sessizce MetaMask
  imza istemi görürdü. Bunun yerine yeni, **imza gerektirmeyen** bir route
  eklendi: `/api/messages/unread/[address]` + `lib/messages-store.ts`'teki
  `hasNewMessagesSince()` — sadece `{hasUnread: boolean}` döndürüyor, mesaj
  metni ya da karşı taraf adresi asla açığa çıkmıyor, o yüzden auth'suz
  bırakmak güvenli.
- **Doğrulama**: gerçek bir private key ile doğru formatta imza üretilip
  canlı dev server'a karşı test edildi — imzasız istek 401, kendi adresin
  için geçerli imza 200 (gerçek konuşmalarını döndürüyor), aynı imzayla
  BAŞKA bir adres iddia etmek 401, `[from]/[to]`'da taraf olmayan biri
  `as=` ile kendini taraf gibi göstermeye çalışınca 401 — hepsi beklendiği
  gibi çalıştı.

## KRİTİK Güvenlik Açığı Düzeltmesi: Bedava Premint Reserve Drain (2. detaylı security-review)
Kullanıcının "mainnet'e geçmeden önce detaylı incele" isteğiyle kontratlara
saldırgan gözüyle bakan ayrı bir agent + bağımsız false-positive doğrulama
turu çalıştırıldı (aynı yöntem: bulgu ajanı → her bulgu için ayrı doğrulama
ajanı → sadece güven ≥8 olanlar rapora giriyor). Üç bulgu çıktı:

1. **KRİTİK (9/10 doğrulandı, gerçek Hardhat PoC ile çalıştırıldı)**:
   `registerUser` her kayıt olana **bedava** 1.000 pay (`CREATOR_PREMINT_BASIS`
   üzerinden %10) veriyordu, ama bu paylar için hiç USDC platformnun
   rezervine girmiyordu. `sellToken` ise ödemeyi **tek, ortak** `usdc`
   bakiyesinden yapıyordu (her token'ın ayrı bir kasası yok). Sonuç: sıfır
   USDC'si olan biri kayıt olup bedava payını satarak **başka kullanıcıların
   yatırdığı parayı** çekebiliyordu (PoC'de: 0 USDC yatırıp 327.84 USDC
   çıkardı). Sybil ile tekrarlanabilir, sonunda rezerv biter, gerçek
   kullanıcılar kendi ödedikleri payları bile satamaz hale gelirdi.
   **Düzeltme (kullanıcının önerisiyle — "yeni kayıt olanlara hiç token
   vermesen olmaz mı" — bu, "creator kendi premint'ini gerçek fiyattan satın
   alsın" alternatifinden daha temiz/sağlam çıktı)**: `UserToken`
   constructor'ından premint mint'i tamamen kaldırıldı,
   `SocialFiPlatform.CREATOR_PREMINT_BASIS` sabiti silindi. Artık her
   token'ın arzı **0'dan** başlıyor ve SADECE ödemeli `buyToken` üzerinden
   büyüyor — arkasız/bedava arz artık hiç var olamıyor, açığın kökü
   kapandı. `test/SocialFiPlatform.test.ts`'e iki regresyon testi eklendi
   ("security regressions" describe bloğu): sıfır USDC'li taze kayıt hiçbir
   şey satamıyor, kayıt olmak hiçbir zaman USDC çekmiyor. 49/49 test yeşil.
   Frontend'deki "10% of the initial share supply is minted to you" metni
   kaldırıldı (`app/register/page.tsx`).
2. **Yüksek (9/10 doğrulandı, matematikle yeniden türetildi)**: Sandwich/MEV
   saldırısı — `buyToken`/`sellToken`'ın herkese açık mempool'da hiç koruması
   yok, `maxCost`/`minReturn` sadece kişinin KENDİ slippage toleransını
   sınırlıyor, başkasının işlemini önden/arkadan sandviçleyip kâr etmeyi
   engellemiyor (örnekte %105 ROI, tek blokta). Bu, herkese açık mempool'lu
   her bonding-curve/AMM'in **doğal, kod hatası olmayan** riski —
   tamamen kapatılamaz ama frontend'de varsayılan slippage toleransını
   sıkılaştırmak (bkz. aşağıdaki not) riski azaltıyor. Mainnet'e geçmeden
   önce kullanıcıya açıkça bildirilmesi gereken, bilinen bir risk.
3. **Elendi (2/10, false positive)**: Kullanıcı adı taklidi — izinsiz kayıt
   sistemlerinin (ENS, Twitter handle'ları gibi) doğal/beklenen özelliği,
   ayrı bir kod hatası değil.

## Genel
- Her yeni bilgi/karar bu dosyaya veya ilgili akış/adım dosyasına eklenmeli;
  bu dosyalar projenin "hafızası"dır.
- Kod yazmadan önce plan gösterilir, kullanıcı onayı beklenir (özellikle
  Phase geçişlerinde).
