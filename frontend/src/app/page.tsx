"use client";

import { useState, useEffect } from "react";
import TradingViewChart from "@/components/TradingViewChart";
import GlobalHeader from "@/components/GlobalHeader";
import CommandPalette from "@/components/CommandPalette";
import InstitutionalSectorFlow from "@/components/InstitutionalSectorFlow";
import MacroNarrativeDashboard from "@/components/MacroNarrativeDashboard";
import MultiAssetWatchlist from "@/components/MultiAssetWatchlist";
import LiveMarketTickerBar from "@/components/LiveMarketTickerBar";
import SinclairVolBox, { SinclairVolatility } from "@/components/SinclairVolBox";
import { REAL_TOP_20_CONVICTION, INSTITUTIONAL_META } from "@/data/realInstitutionalData";

interface Level {
  price: number;
  strength: number;
  volume_concentration?: number;
  source?: string;
  dte?: number | null;
  horizon?: string;
  tests?: number;
  title?: string;
  sublabel?: string;
  is_confluence?: boolean;
  confluence_factors?: string[];
}

interface AnalyticsData {
  ticker: string;
  name?: string;
  spot: number;
  max_pain: number;
  weekly_max_pain?: number;
  monthly_max_pain?: number;
  gamma_flip?: number;
  expected_move_upper?: number;
  expected_move_lower?: number;
  expected_move_range?: number;
  supports: Level[];
  resistances: Level[];
  put_call_ratio: number;
  sentiment: string;
  trend_phase: string;
  iv_regime: string;
  sinclair_volatility?: SinclairVolatility;
}

interface InstData {
  source: string;
  ownershipSummary?: {
    SharesOutstandingPCT?: { label: string; value: string };
    ShareoutstandingTotal?: { label: string; value: string };
    TotalHoldingsValue?: { label: string; value: string };
  };
  activePositions?: Array<{ positions: string; holders: string; shares: string }>;
  newSoldOutPositions?: Array<{ positions: string; holders: string; shares: string }>;
  holdingsTransactions?: Array<any>;
  totalSharesOutstanding?: number;
  analytics?: {
    instAccumulation: number;
    netFundFlow: number;
    totalTurnoverShares: number;
    netShareFlow: number;
  };
  history?: Array<{
    quarter: string;
    totalValue: number;
    totalShares: number;
    activeFunds: number;
    ownershipPct: number;
    hedgeFunds?: number;
    top10?: number;
    increased?: number;
    reduced?: number;
    closed?: number;
  }>;
  qoq?: {
    [key: string]: number;
  };
  quarters?: {
    current: string;
    q1: string;
    q2: string;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://truecharts.onrender.com";

function Top5Panel({
  transactions,
  totalShares,
  quarter,
}: {
  transactions: any[];
  totalShares: number;
  quarter: string;
}) {
  const top5TotalShares = transactions.reduce(
    (acc: number, tx: any) => acc + (parseInt((tx.sharesHeld || "").replace(/,/g, "")) || 0),
    0
  );
  const top5CapPct =
    totalShares > 0 ? ((top5TotalShares / totalShares) * 100).toFixed(3) : "—";

  return (
    <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 flex flex-col gap-3 font-mono">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide">
          Top 5 Institutional Holders
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-[var(--muted)]">{quarter} filing</span>
          <span className="text-[10px] font-bold text-[var(--accent)] border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-0.5 rounded">
            Top 5 = {top5CapPct}% of cap
          </span>
        </div>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-[9px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--line)]">
            <th className="pb-2 font-semibold">Fund</th>
            <th className="pb-2 font-semibold text-right">Shares</th>
            <th className="pb-2 font-semibold text-right">% Cap</th>
            <th className="pb-2 font-semibold text-right">Chg</th>
            <th className="pb-2 font-semibold text-right">Chg%</th>
            <th className="pb-2 font-semibold text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx: any, i: number) => {
            const isPos =
              !tx.sharesChangePCT?.includes("-") &&
              tx.sharesChangePCT !== "0%" &&
              tx.sharesChangePCT !== "New";
            const isNeg = Boolean(tx.sharesChangePCT?.includes("-"));
            const isNew = tx.sharesChangePCT === "New";
            const shareCount = parseInt((tx.sharesHeld || "").replace(/,/g, "")) || 0;
            const capPct =
              totalShares > 0 ? ((shareCount / totalShares) * 100).toFixed(3) : "—";
            const color =
              isPos || isNew
                ? "text-[var(--up)]"
                : isNeg
                ? "text-[var(--down)]"
                : "text-[var(--muted)]";
            const bar =
              isPos || isNew ? "bg-[var(--up)]" : isNeg ? "bg-[var(--down)]" : "bg-[var(--hover)]";
            return (
              <tr
                key={i}
                className="border-b border-[var(--line)] hover:bg-[var(--hover)] transition-colors"
              >
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-0.5 h-3.5 rounded-full shrink-0 ${bar}`}></div>
                    <span
                      className="text-[10px] font-bold text-[var(--fg)] truncate max-w-[120px]"
                      title={tx.ownerName}
                    >
                      {tx.ownerName}
                    </span>
                  </div>
                </td>
                <td className="py-2 text-[10px] text-[var(--muted)] text-right">{tx.sharesHeld}</td>
                <td className="py-2 text-[11px] text-[var(--accent)] text-right font-bold">{capPct}%</td>
                <td className={`py-2 text-[10px] text-right font-bold ${color}`}>
                  {isPos || isNew ? "+" : ""}
                  {tx.sharesChange}
                </td>
                <td className={`py-2 text-[10px] text-right font-bold ${color}`}>
                  {isNew ? (
                    <span className="px-1 py-0.5 bg-[var(--up)]/20 rounded text-[8px] uppercase">
                      NEW
                    </span>
                  ) : (
                    tx.sharesChangePCT
                  )}
                </td>
                <td className="py-2 text-[10px] text-[var(--muted)] text-right">{tx.marketValue}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Home() {
  const [ticker, setTicker] = useState("SPY");
  const [timeframe, setTimeframe] = useState("1d");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [instData, setInstData] = useState<InstData | null>(null);
  const [error, setError] = useState("");
  const [instError, setInstError] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const fetchAnalysis = async (symbol: string, tf: string = timeframe) => {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return;

    setLoading(true);
    setError("");
    setInstData(null);
    setInstError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(
        `${API_URL}/api/analyze/${cleanSym}?timeframe=${encodeURIComponent(tf)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("Ticker not supported or API offline");
      const result = await res.json();
      setData(result);

      try {
        let loadedInst = false;
        try {
          const instController = new AbortController();
          const instTimeoutId = setTimeout(() => instController.abort(), 15000);
          const instRes = await fetch(`${API_URL}/api/institutional/${cleanSym}`, {
            signal: instController.signal
          });
          clearTimeout(instTimeoutId);
          if (instRes.ok) {
            const iData = await instRes.json();
            setInstData(iData);
            loadedInst = true;
          }
        } catch {
          // Backend offline or unreachable
        }

        if (!loadedInst) {
          // Backend unreachable: fall back to the auto-updated 13F dataset (no invented totals).
          const realStock = REAL_TOP_20_CONVICTION.find((s) => s.symbol === cleanSym);
          if (realStock && realStock.topHolders && realStock.topHolders.length > 0) {
            setInstData({
              source: INSTITUTIONAL_META.source,
              quarters: {
                current: INSTITUTIONAL_META.latestFilingQuarter ?? "",
                q1: "",
                q2: "",
              },
              totalSharesOutstanding: 0, // unknown here, so "% of cap" shows as —
              ownershipSummary: {
                SharesOutstandingPCT: { label: "% Held by Institutions", value: `${realStock.instPct}%` },
                TotalHoldingsValue: { label: "Total Institutional Holdings", value: realStock.valB },
              },
              holdingsTransactions: realStock.topHolders.map((th) => {
                const shares = Number(th.shares.replace(/,/g, "")) || 0;
                const pct = parseFloat(th.pct) / 100;
                const change = pct > -1 ? Math.round((shares * pct) / (1 + pct)) : 0;
                return {
                  ownerName: th.holder,
                  sharesHeld: th.shares,
                  marketValue: th.val,
                  sharesChangePCT: th.pct,
                  sharesChange: Math.abs(change).toLocaleString("en-US"),
                };
              }),
            });
            setInstError(null);
          } else {
            setInstData(null);
          }
        }
      } catch (e: any) {
        console.error("Failed to fetch institutional data", e);
      }
    } catch (err: unknown) {
      console.warn("API offline or error", err);
      setError("Unable to connect to live options backend (https://truecharts.onrender.com). The free server may be spinning up. Please click 'Analyze' again in 15 seconds.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis("SPY", "1d");
  }, []);

  const handleSelectTicker = (symbol: string) => {
    const target = symbol.trim().toUpperCase();
    if (target) {
      setTicker(target);
      fetchAnalysis(target, timeframe);
    }
  };

  const handleFormSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleSelectTicker(ticker);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] font-sans flex flex-col pb-16">
      {/* MODULE 1: GLOBAL HEADER BAR */}
      <GlobalHeader
        ticker={ticker}
        setTicker={setTicker}
        onSearchSubmit={handleSelectTicker}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        apiConnected={!!data}
      />

      {/* COMMAND PALETTE MODAL (CMD+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectSymbol={handleSelectTicker}
      />

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 p-4 lg:p-6 max-w-[125rem] w-full mx-auto flex flex-col gap-6">
        
        {/* TOP SECTION: SIDEBAR + MAIN SYSTEM CHART + POSITIONING PANEL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT SIDEBAR: Symbol Search Controls & Key Metrics */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            {/* Symbol Analysis Card */}
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider font-mono">
                  Target Asset & Timeframe
                </h2>
                {loading && (
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                    loading...
                  </span>
                )}
              </div>

              <form onSubmit={handleFormSearch} className="flex flex-col gap-3">
                <div>
                  <label className="block text-[10px] text-[var(--muted)] uppercase font-mono font-bold mb-1">
                    Symbol Ticker
                  </label>
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--line)] rounded px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--accent)] font-mono uppercase font-bold"
                    placeholder="e.g. SPY, AAPL"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[var(--muted)] uppercase font-mono font-bold mb-1">
                    Chart Timeframe
                  </label>
                  <select
                    value={timeframe}
                    onChange={(e) => {
                      const newTf = e.target.value;
                      setTimeframe(newTf);
                      fetchAnalysis(ticker, newTf);
                    }}
                    className="w-full bg-[var(--bg)] border border-[var(--line)] rounded px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--accent)] font-mono font-semibold"
                  >
                    <option value="5 min">5 min</option>
                    <option value="15 min">15 min</option>
                    <option value="1h">1h</option>
                    <option value="4h">4h</option>
                    <option value="1d">1d</option>
                    <option value="1w">1w</option>
                    <option value="1m">1m</option>
                    <option value="3m">3m</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[var(--up)] hover:bg-[var(--up)] disabled:bg-[var(--hover)] text-white font-mono font-bold text-xs py-2.5 rounded transition-all mt-1 uppercase tracking-wider"
                >
                  {loading ? "FETCHING QUANT DATA..." : "ANALYZE ASSET FLOWS"}
                </button>
              </form>
              {error && <p className="text-[var(--down)] text-xs font-mono">{error}</p>}
            </div>

            {/* Quick Analytics Summary */}
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 flex flex-col gap-3 font-mono">
              <h2 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                Options & Volatility Regime
              </h2>
              <div className="flex justify-between items-center py-1.5 border-b border-[var(--line)]">
                <span className="text-[var(--muted)] text-xs">Put/Call Ratio</span>
                <span className="text-[var(--fg)] text-xs font-bold">
                  {data?.put_call_ratio != null ? data.put_call_ratio : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[var(--line)]">
                <span className="text-[var(--muted)] text-xs">Volatility Regime</span>
                <span className="text-[var(--accent)] text-xs font-bold">
                  {data ? data.iv_regime : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[var(--line)]">
                <span className="text-[var(--muted)] text-xs">Trend Phase</span>
                <span className="text-[var(--up)] text-xs font-bold">
                  {data ? data.trend_phase : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-[var(--muted)] text-xs">Market Sentiment</span>
                <span className="text-[var(--up)] text-xs font-bold">
                  {data ? data.sentiment : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* CENTER: SYSTEM CHART (SYSTEM CHART FUNCTIONALITY PRESERVED EXACTLY AS REQUESTED) */}
          <div className="lg:col-span-9 flex flex-col gap-6">
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-5 flex flex-col w-full min-h-[500px]">
              <div className="flex items-center justify-between mb-3 border-b border-[var(--line)] pb-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold font-mono text-[var(--fg)] tracking-tight">
                      {data?.ticker || ticker}
                    </h1>
                    <span className="text-xs font-mono text-[var(--muted)] bg-[var(--hover)] border border-[var(--line)] px-2 py-0.5 rounded">
                      SPOT: ${data?.spot ? data.spot.toFixed(2) : "—"}
                    </span>
                    <span className="text-xs font-mono text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 px-2 py-0.5 rounded">
                      MAX PAIN: ${data?.max_pain ? data.max_pain.toFixed(2) : "—"}
                    </span>
                  </div>
                  <p className="text-[var(--muted)] font-mono text-xs mt-1">
                    {data?.name && data.name !== data.ticker ? data.name : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-[var(--muted)]">Timeframe:</span>
                  <span className="text-[var(--up)] font-bold uppercase">{timeframe}</span>
                </div>
              </div>

              {/* The Core System Chart */}
              <div className="flex-1 min-h-[440px] flex flex-col relative">
                {data ? (
                  <TradingViewChart
                    ticker={data.ticker}
                    spot={data.spot}
                    maxPain={data.max_pain}
                    weeklyMaxPain={data.weekly_max_pain}
                    monthlyMaxPain={data.monthly_max_pain}
                    gammaFlip={data.gamma_flip}
                    expectedMoveUpper={data.expected_move_upper}
                    expectedMoveLower={data.expected_move_lower}
                    expectedMoveRange={data.expected_move_range}
                    supports={data.supports}
                    resistances={data.resistances}
                    timeframe={timeframe}
                    sinclairVolatility={data.sinclair_volatility}
                  />
                ) : (
                  <div className="flex-1 w-full bg-[var(--bg)] rounded flex flex-col items-center justify-center border border-[var(--line)] p-6 text-center">
                    <span className="text-xs text-[var(--muted)] font-mono mb-2">
                      {loading ? "Connecting to live options engine (waking up server)..." : (error || "Select a symbol to view interactive chart")}
                    </span>
                    {error && (
                      <button
                        onClick={() => fetchAnalysis(ticker, timeframe)}
                        className="mt-2 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 px-3 py-1.5 rounded text-xs font-mono font-bold"
                      >
                        ⚡ Retry Live Connection
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* SINCLAIR VOLATILITY & FLOW INTELLIGENCE BOX */}
            <SinclairVolBox
              volData={data?.sinclair_volatility}
              spot={data?.spot}
              ticker={data?.ticker || ticker}
            />
          </div>

        </div>

        {/* 13F INSTITUTIONAL POSITIONING PANEL */}
        {instData && (instData.ownershipSummary || instData.history) && (
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4 font-mono">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h2 className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">
                  Detailed Institutional Position Breakdown · {ticker}
                </h2>
                <p className="text-[10px] text-[var(--muted)]">
                  {instData.source || "13F filings"}
                </p>
              </div>
              <span className="text-[10px] text-[var(--up)] bg-[var(--up)]/10 border border-[var(--up)]/30 px-2 py-0.5 rounded font-bold">
                13F FILINGS
              </span>
            </div>

            {/* Top 5 Transactions */}
            {instData.holdingsTransactions && instData.holdingsTransactions.length > 0 && (
              <Top5Panel
                transactions={instData.holdingsTransactions.slice(0, 5)}
                totalShares={instData.totalSharesOutstanding ?? 0}
                quarter={instData.quarters?.current ?? ""}
              />
            )}
          </div>
        )}

        {/* MODULE 3: 13F INSTITUTIONAL FLOW & SECTOR ROTATION */}
        <InstitutionalSectorFlow onSelectTicker={handleSelectTicker} />

        {/* MODULE 4: MACRO NARRATIVE DASHBOARD */}
        <MacroNarrativeDashboard />

        {/* MODULE 5: MULTI-ASSET WATCHLIST WITH ORDER FLOW CONTEXT */}
        <MultiAssetWatchlist
          activeTicker={ticker}
          onSelectTicker={handleSelectTicker}
          analytics={data ? { ticker: data.ticker, put_call_ratio: data.put_call_ratio, max_pain: data.max_pain, gamma_flip: data.gamma_flip } : null}
        />

      </main>

      {/* MODULE 7: LIVE MARKET TICKER (PINNED TO BOTTOM) */}
      <LiveMarketTickerBar onSelectTicker={handleSelectTicker} />
    </div>
  );
}
