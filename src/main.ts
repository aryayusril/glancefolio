import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

// ---------------------------------------------------------------------------
// Glancefolio — a glanceable, read-only crypto companion for Even G2.
// Track 02 (Crypto & DeFi), Heads Up Hackathon.
//
// READ:  live spot prices + 24h change (CoinGecko public API, no key),
//        portfolio value computed from the user's own watchlist amounts.
// WRITE: the user edits watchlist amounts + price-alert thresholds on the
//        phone companion page; on the glasses, taps cycle views and scroll
//        moves the coin selection. Alerts surface on-glass when crossed.
// SAFETY: read-only. No trading, no wallet connection, no financial advice.
// ---------------------------------------------------------------------------

type CoinId = 'bitcoin' | 'ethereum' | 'solana'

interface Holding {
  id: CoinId
  symbol: string
  amount: number
}

interface AlertRule {
  id: CoinId
  symbol: string
  above?: number
  below?: number
}

interface Config {
  holdings: Holding[]
  alerts: AlertRule[]
}

const CONFIG_KEY = 'glancefolio-config-v1'

const DEFAULT_CONFIG: Config = {
  holdings: [
    { id: 'bitcoin', symbol: 'BTC', amount: 0.05 },
    { id: 'ethereum', symbol: 'ETH', amount: 0.8 },
    { id: 'solana', symbol: 'SOL', amount: 12 },
  ],
  alerts: [
    { id: 'bitcoin', symbol: 'BTC', above: 100000 },
    { id: 'ethereum', symbol: 'ETH', below: 3000 },
  ],
}

function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return structuredClone(DEFAULT_CONFIG)
    const parsed = JSON.parse(raw) as Config
    if (!Array.isArray(parsed.holdings) || !Array.isArray(parsed.alerts)) {
      return structuredClone(DEFAULT_CONFIG)
    }
    return parsed
  } catch {
    return structuredClone(DEFAULT_CONFIG)
  }
}

function saveConfig(cfg: Config) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
  } catch {
    /* storage unavailable — app keeps running with in-memory config */
  }
}

// Demo fallback so the glasses UI never goes blank when the network or the
// rate-limited public API is unavailable. Always labelled DEMO on screen.
const DEMO_PRICES: Record<CoinId, { usd: number; chg: number }> = {
  bitcoin: { usd: 91240, chg: 1.84 },
  ethereum: { usd: 3412, chg: -0.62 },
  solana: { usd: 214.5, chg: 3.21 },
}

type PriceMap = Record<CoinId, { usd: number; chg: number }>

async function fetchPrices(): Promise<{ prices: PriceMap; live: boolean }> {
  try {
    const ids = 'bitcoin,ethereum,solana'
    const url =
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}` +
      `&vs_currencies=usd&include_24hr_change=true`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = (await res.json()) as Record<string, { usd: number; usd_24h_change: number }>
    return {
      live: true,
      prices: {
        bitcoin: { usd: j.bitcoin.usd, chg: j.bitcoin.usd_24h_change },
        ethereum: { usd: j.ethereum.usd, chg: j.ethereum.usd_24h_change },
        solana: { usd: j.solana.usd, chg: j.solana.usd_24h_change },
      },
    }
  } catch {
    return { prices: DEMO_PRICES, live: false }
  }
}

function fmtUsd(v: number): string {
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (v >= 1) return '$' + v.toFixed(2)
  return '$' + v.toFixed(4)
}

function fmtChg(c: number): string {
  const sign = c >= 0 ? '+' : ''
  return `${sign}${c.toFixed(2)}%`
}

// ---------------------------------------------------------------------------
// State + rendering (glasses: 576x288, green monochrome, text containers)
// ---------------------------------------------------------------------------

type View = 'prices' | 'portfolio' | 'alerts'
const VIEWS: View[] = ['prices', 'portfolio', 'alerts']

let config = loadConfig()
let prices: PriceMap = DEMO_PRICES
let live = false
let view: View = 'prices'
let selected = 0
const firedAlerts = new Set<string>()

function checkAlerts(): string[] {
  const out: string[] = []
  for (const a of config.alerts) {
    const p = prices[a.id]?.usd
    if (p == null) continue
    const keyUp = `${a.symbol}-above`
    const keyDn = `${a.symbol}-below`
    if (a.above != null && p >= a.above && !firedAlerts.has(keyUp)) {
      firedAlerts.add(keyUp)
      out.push(`ALERT ${a.symbol} >= ${fmtUsd(a.above)} (now ${fmtUsd(p)})`)
    }
    if (a.below != null && p <= a.below && !firedAlerts.has(keyDn)) {
      firedAlerts.add(keyDn)
      out.push(`ALERT ${a.symbol} <= ${fmtUsd(a.below)} (now ${fmtUsd(p)})`)
    }
  }
  return out
}

function renderMain(): string {
  const tag = live ? 'LIVE' : 'DEMO'
  if (view === 'prices') {
    const lines = config.holdings.map((h, i) => {
      const p = prices[h.id]
      const cur = i === selected ? '>' : ' '
      return `${cur} ${h.symbol}  ${fmtUsd(p.usd)}  ${fmtChg(p.chg)} 24h`
    })
    return [`PRICES (${tag})`, ...lines, '', 'Tap: next view - Scroll: select'].join('\n')
  }
  if (view === 'portfolio') {
    let total = 0
    const lines = config.holdings.map(h => {
      const v = prices[h.id].usd * h.amount
      total += v
      return `${h.symbol}  ${h.amount} x ${fmtUsd(prices[h.id].usd)} = ${fmtUsd(v)}`
    })
    return [
      `PORTFOLIO (${tag})`,
      ...lines,
      '',
      `TOTAL  ${fmtUsd(total)}`,
      'Read-only. Not financial advice.',
    ].join('\n')
  }
  const lines = config.alerts.map(a => {
    const parts: string[] = []
    if (a.above != null) parts.push(`>= ${fmtUsd(a.above)}`)
    if (a.below != null) parts.push(`<= ${fmtUsd(a.below)}`)
    return `${a.symbol}  ${parts.join('  ')}`
  })
  return ['PRICE ALERTS', ...(lines.length ? lines : ['(none set)']), '', 'Edit alerts on your phone.'].join('\n')
}

// ---------------------------------------------------------------------------
// Bridge wiring
// ---------------------------------------------------------------------------

const bridge = await waitForEvenAppBridge()

const header = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 36,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 1,
  containerName: 'header',
  content: 'GLANCEFOLIO',
  isEventCapture: 0,
})

const mainBox = new TextContainerProperty({
  xPosition: 0,
  yPosition: 40,
  width: 576,
  height: 208,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 2,
  containerName: 'main',
  content: 'Loading prices...',
  isEventCapture: 1,
})

const footer = new TextContainerProperty({
  xPosition: 0,
  yPosition: 252,
  width: 576,
  height: 36,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 3,
  containerName: 'footer',
  content: 'Double-tap to exit',
  isEventCapture: 0,
})

await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 3,
    textObject: [header, mainBox, footer],
  }),
)

function pushMain() {
  bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 2,
      containerName: 'main',
      content: renderMain(),
    }),
  )
}

function pushHeader(text: string) {
  bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 1,
      containerName: 'header',
      content: text,
    }),
  )
}

async function refresh() {
  const r = await fetchPrices()
  prices = r.prices
  live = r.live
  const alerts = checkAlerts()
  if (alerts.length) pushHeader(alerts[0])
  pushMain()
}

await refresh()
setInterval(refresh, 60_000)

// Reads the event type out of one envelope. CLICK_EVENT is 0 and protobuf
// omits zero-value fields, so a tap arrives with eventType === undefined;
// resolve the default INSIDE the envelope check (per the official template).
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

const unsubscribe = bridge.onEvenHubEvent(event => {
  const sysType = eventTypeOf(event.sysEvent)
  const textType = eventTypeOf(event.textEvent)

  // Double-tap exit is a root-level check: it must fire from any envelope.
  if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    bridge.shutDownPageContainer(1)
    return
  }

  // Scroll gestures arrive via textEvent: move the coin selection.
  if (event.textEvent && textType !== OsEventTypeList.CLICK_EVENT) {
    const n = config.holdings.length
    if (n > 0) {
      selected = (selected + 1) % n
      if (view !== 'prices') view = 'prices'
      pushMain()
    }
    return
  }

  if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
    const i = VIEWS.indexOf(view)
    view = VIEWS[(i + 1) % VIEWS.length]
    pushMain()
    return
  }

  if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    unsubscribe()
  }
})

// ---------------------------------------------------------------------------
// Phone companion UI: edit watchlist amounts (the write path of the app).
// Runs in the same WebView document; config persists in localStorage.
// ---------------------------------------------------------------------------

const rootEl = document.getElementById('app')
if (rootEl) {
  rootEl.innerHTML = ''
  const title = document.createElement('h1')
  title.textContent = 'Glancefolio — watchlist'
  rootEl.appendChild(title)

  config.holdings.forEach((h, idx) => {
    const row = document.createElement('label')
    row.className = 'row'
    const span = document.createElement('span')
    span.textContent = h.symbol
    const input = document.createElement('input')
    input.type = 'number'
    input.step = 'any'
    input.min = '0'
    input.value = String(h.amount)
    input.addEventListener('change', () => {
      const v = parseFloat(input.value)
      if (Number.isFinite(v) && v >= 0) {
        config.holdings[idx].amount = v
        saveConfig(config)
        pushMain()
      }
    })
    row.append(span, input)
    rootEl.appendChild(row)
  })

  const note = document.createElement('p')
  note.className = 'note'
  note.textContent =
    'Amounts are stored only on this phone. Prices are read-only from a public API. ' +
    'No trading, no wallet connection, not financial advice. The glasses display updates live.'
  rootEl.appendChild(note)
}
