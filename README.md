# ShareSelf

A SocialFi demo on **Arc Testnet**: every registered user gets a bonding-curve
share token that can be bought and sold with USDC, and share holders can
unlock gated direct messaging with a creator.

> ⚠️ **This is a testnet demo, not real financial advice.** Tokens have no
> real-world value. Only Arc Testnet is supported — never point this at
> mainnet or connect a wallet holding real funds.

## Live deployment

| | |
|---|---|
| Live URL | _not yet deployed (frontend not on Vercel yet)_ |
| SocialFiPlatform | [`0x64e7274Cef17C8DFBDC7b1bA201490E190f94193`](https://testnet.arcscan.app/address/0x64e7274Cef17C8DFBDC7b1bA201490E190f94193) |
| DirectMessaging | [`0xb714F71293c54a4f6C39F6CFd3D814179826fA67`](https://testnet.arcscan.app/address/0xb714F71293c54a4f6C39F6CFd3D814179826fA67) |
| USDC (Arc Testnet) | [`0x3600000000000000000000000000000000000000`](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) — confirmed live: symbol `USDC`, 6 decimals |

## Network

- **Chain**: Arc Testnet, chain id `5042002`
- **RPC**: `https://rpc.testnet.arc.network`
- **Explorer**: `https://testnet.arcscan.app`
- **Faucet**: `https://faucet.circle.com`
- Native gas token is USDC at **18 decimals**; the ERC-20 USDC used for all
  payments in this app (`0x3600...`) is a **separate token at 6 decimals**.
  Never mix the two.

> Chain id, RPC reachability, and the USDC contract (address, `symbol()`,
> `decimals()`) were empirically confirmed live on 2026-08-25 by querying
> the network directly — not by cross-checking Arc's official docs (no such
> check has been done). Native gas being 18-decimal USDC is still an
> assumption from the project's original brief, consistent with what we saw
> but not independently proven. See `train.md` for the full trail.

## Project structure

- `contracts/`, `test/`, `scripts/` — Hardhat project (Solidity contracts +
  tests + deploy script). See `dosya-yapısı.md` for the full layout.
- `frontend/` — Next.js (App Router) app: pages, API routes, wagmi/viem/
  RainbowKit wiring. See `frontend/lib/` for chain config and on-chain data
  helpers.
- `train.md` — running log of architecture decisions and known limitations;
  read this before making changes.

## Local setup

### 1. Contracts

```bash
npm install
cp .env.example .env        # fill in DEPLOYER_PRIVATE_KEY yourself — never share it
npx hardhat compile
npx hardhat test             # should be 47/47 green
```

`DEPLOYER_PRIVATE_KEY` should be a **testnet-only** key funded with Arc
Testnet USDC from the faucet above — never a key holding real funds.

### 2. Deploy (local Hardhat network, for development)

```bash
npx hardhat run scripts/deploy.ts --network hardhat
```

This writes `NEXT_PUBLIC_*` contract addresses straight into
`frontend/.env.local`.

### 3. Deploy to Arc Testnet (for real testnet use)

```bash
npx hardhat run scripts/deploy.ts --network arcTestnet
```

Same as above, but against the live Arc Testnet — requires a funded
`DEPLOYER_PRIVATE_KEY` in `.env`. Update the addresses at the top of this
README afterward.

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_* addresses are usually already
                              # filled in by scripts/deploy.ts — just add a
                              # NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID from
                              # https://cloud.reown.com
npm run dev
```

Open `http://localhost:3000`, connect a wallet, switch to Arc Testnet, and
get testnet USDC from the faucet before registering or trading.

## Deploying the frontend to Vercel

This repo is a monorepo: the Hardhat project lives at the repo root and the
Next.js app lives in `frontend/`. `frontend/lib/contracts.ts` imports contract
ABIs directly from the repo root's `artifacts/` folder (see `train.md`) —
which is git-ignored build output, not checked into the repo. Two things
follow from that:

1. **Vercel project settings**: set **Root Directory** to `frontend`, but
   enable Vercel's *"Include files outside the root directory in the Build
   Step"* option (under Root Directory settings) — otherwise the ABI imports
   won't resolve. Override the **Build Command** to compile the contracts
   first: `cd .. && npm install && npx hardhat compile && cd frontend && npm run build`.
   (Confirm the exact toggle/field names against Vercel's current dashboard —
   this wasn't verified against a live Vercel deploy.)
2. **Environment variables** to set on the Vercel project (Settings →
   Environment Variables), matching `frontend/.env.example`:
   `NEXT_PUBLIC_USDC_ADDRESS`, `NEXT_PUBLIC_SOCIALFI_PLATFORM_ADDRESS`,
   `NEXT_PUBLIC_DIRECT_MESSAGING_ADDRESS` (from the Arc Testnet deploy above),
   `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, and optionally
   `NEXT_PUBLIC_ARC_TESTNET_RPC_URL`.

> ⚠️ **Messaging will not work on Vercel as-is.** `lib/messages-store.ts`
> writes to `process.cwd()/.data/messages.json`, but Vercel's serverless
> function filesystem is **read-only** — sending a message will throw
> (500), not just fail to persist. Swap `messages-store.ts` for a real
> datastore (Vercel KV, Upstash Redis, Postgres, etc.) before deploying
> anywhere users will actually try to message each other; see `train.md`'s
> Phase 3 data-architecture notes for the tradeoffs that led to the current
> file-based store.

## Known limitations (see `train.md` for details)

- DM message content is stored in a local JSON file
  (`frontend/lib/messages-store.ts`), not a database — it won't persist on a
  serverless deploy (Vercel) and should be swapped for a real store before
  any real-user deployment.
- Message sending isn't signature-authenticated.
- Leaderboard/price-history/holdings are derived by scanning on-chain event
  logs on every request (no indexer/DB) — fine at demo scale, slower as the
  number of registered users grows.

## Security

- Never commit a real private key, RPC URL with an embedded API key, or any
  other secret. `.env` and `frontend/.env.local` are git-ignored; only
  `.env.example`/`frontend/.env.example` (placeholders) are committed.
- Only Arc Testnet is supported. Do not deploy these contracts to mainnet or
  connect a wallet holding real funds.
