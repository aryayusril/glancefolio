# Glancefolio

A glanceable, read-only crypto companion for Even Realities G2 smart glasses.

**Heads Up Hackathon — Track 02: Crypto & DeFi**

## The problem

Crypto holders check prices dozens of times a day by pulling out their phone —
in meetings, on a bike, mid-conversation. The information they want is tiny
(a price, a 24h move, a portfolio total, "did my alert trigger?"), but getting
it costs full phone attention every time.

## What it does

Glancefolio puts that tiny slice of information on the G2 display:

- **Prices view** — BTC, ETH, SOL spot prices with 24h change, refreshed
  every 60 seconds from the CoinGecko public API (no key, read-only).
- **Portfolio view** — the value of the user's own watchlist, computed from
  amounts the user enters on the phone companion page.
- **Alerts view** — price thresholds (e.g. BTC ≥ $100,000) that surface as an
  on-glass alert banner the moment they are crossed.

Interactions on the glasses: **tap** cycles Prices → Portfolio → Alerts,
**scroll** moves the coin selection, **double-tap** exits. On the phone, the
companion page is the write path: edit holding amounts (stored only in the
phone's local storage) and the glasses display updates live.

## Safety

Read-only by design. No trading, no wallet connection, no keys, no financial
advice — the portfolio screen says so on the glass itself. If the price API
is unreachable, the app falls back to clearly labelled DEMO data instead of
going blank.

## Setup

```bash
npm install
npm run dev        # companion page on http://localhost:5173
npm run simulate   # opens the Even Hub desktop simulator against the dev server
npm run build      # type-check + production build
npm run pack       # build + package .ehpk
```

## Built during the hackathon

Built from scratch during the Heads Up build week (23–29 Nov 2026), starting
from the official Even Hub minimal template (declared here per the rules).
Pre-existing components used: `@evenrealities/even_hub_sdk`, Vite, TypeScript,
and the CoinGecko public price API. All application logic is original.

## Author

Aria Yusril (solo) — @zeronamei
