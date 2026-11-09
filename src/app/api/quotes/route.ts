// Live quotes for the ticker bar, watchlist and command palette.
// GET /api/quotes?symbols=SPY,QQQ,VIX  →  { quotes: Quote[], asOf }
// Source: Yahoo Finance chart endpoint (delayed). Symbols that fail are returned as null,
// never filled with placeholder numbers.

export interface Quote {
  symbol: string;
  price: number;
  prevClose: number;
  changePct: number;
  volume: number | null;
  avgVolume20: number | null;
  closes5: number[];
  time: string;
}

// Display symbol → Yahoo symbol
const YAHOO: Record<string, string> = {
  VIX: "^VIX",
  TNX: "^TNX",
  DXY: "DX-Y.NYB",
  GOLD: "GC=F",
  "CL1!": "CL=F",
  "ES1!": "ES=F",
  "NQ1!": "NQ=F",
  "BTC/USD": "BTC-USD",
  "EUR/USD": "EURUSD=X",
};

async function fetchQuote(symbol: string): Promise<Quote | null> {
  const y = YAHOO[symbol] ?? symbol.replace(".", "-");
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=2mo&interval=1d`,
      {
        headers: { "User-Agent": "truecharts/1.0 (+https://github.com/kaloyantosev/truecharts)" },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.chart?.result?.[0];
    const meta = r?.meta;
    const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
    const vols: (number | null)[] = r?.indicators?.quote?.[0]?.volume ?? [];
    const valid = closes.map((c, i) => ({ c, v: vols[i] })).filter((x) => x.c != null) as { c: number; v: number | null }[];
    const price = meta?.regularMarketPrice ?? valid[valid.length - 1]?.c;
    if (price == null || valid.length < 2) return null;
    // Previous session close: the last daily close before today's bar.
    const prevClose = valid[valid.length - 2].c;
    const volume = valid[valid.length - 1]?.v ?? null;
    const prior = valid.slice(-21, -1).map((x) => x.v).filter((v): v is number => v != null && v > 0);
    const avgVolume20 = prior.length >= 10 ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
    return {
      symbol,
      price,
      prevClose,
      changePct: ((price - prevClose) / prevClose) * 100,
      volume: volume && volume > 0 ? volume : null,
      avgVolume20,
      closes5: valid.slice(-5).map((x) => x.c),
      time: new Date((meta?.regularMarketTime ?? 0) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 40);
  const quotes = await Promise.all(symbols.map(fetchQuote));
  return Response.json(
    { quotes: quotes.filter(Boolean), missing: symbols.filter((_, i) => !quotes[i]), asOf: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
