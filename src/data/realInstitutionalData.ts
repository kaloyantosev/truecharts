// 13F institutional ownership, refreshed automatically by scripts/update_data.py
// (GitHub Action "Refresh 13F, macro and COT data"). Do not edit the JSON by hand.
import data from "./institutional.json";

export interface RealTop20Position {
  rank: number;
  symbol: string;
  name: string;
  sector: string;
  holders: number; // number of 13F institutions holding the stock
  instPct: number; // % of shares held by institutions
  valB: string; // institutional holdings value
  holderChg: string; // QoQ net share change of the 10 largest holders
  trend: string; // Accumulation / Distribution / Neutral from holderChg (±1%)
  topHolders: Array<{
    holder: string;
    shares: string;
    val: string;
    pct: string;
    reported: string;
  }>;
}

export interface SectorData {
  name: string;
  code: string;
  netFlow: number; // $B, net value of top-holder share changes across the sector's leaders
  maxFlow: number;
  topBuyStocks: Array<{ ticker: string; shares: string; value: string; flow: string }>;
  topSellStocks: Array<{ ticker: string; shares: string; value: string; flow: string }>;
}

export interface BubbleStock {
  ticker: string;
  sizeB: number; // institutional holdings, $B
  qoqChg: number; // QoQ top-holder net share change, %
  perf3M: number; // 3-month price return, %
  color: string;
}

export const INSTITUTIONAL_META = {
  asOf: data.asOf as string,
  latestFilingQuarter: (data.latestFilingQuarter ?? null) as string | null,
  source: data.source as string,
  method: data.method as string,
};

export const REAL_TOP_20_CONVICTION: RealTop20Position[] = data.top20;

export const REAL_GICS_SECTORS: SectorData[] = data.sectors;

export const REAL_BUBBLE_STOCKS: BubbleStock[] = data.bubbles.map((b) => ({
  ...b,
  color: b.qoqChg > 0 && b.perf3M > 0 ? "var(--up)" : b.qoqChg < 0 && b.perf3M < 0 ? "var(--down)" : "var(--accent)",
}));

/** Per-symbol 13F summary for the watchlist and other panels. */
export const INSTITUTIONAL_BY_SYMBOL: Record<string, { instPct: number | null; holders: number; flowPct: number; trend: string }> =
  data.bySymbol;
