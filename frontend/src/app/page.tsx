"use client";

import { useState, useEffect } from "react";
import TradingViewChart from "@/components/TradingViewChart";

interface Level {
  price: number;
  strength: number;
  volume_concentration?: number;
  source?: string;
  dte?: number | null;
  horizon?: string;
  tests?: number;
}

interface AnalyticsData {
  ticker: string;
  name?: string;
  spot: number;
  max_pain: number;
  supports: Level[];
  resistances: Level[];
  put_call_ratio: number;
  sentiment: string;
  trend_phase: string;
  iv_regime: string;
}

interface PredictiveSector {
  sector: string;
  options_grade: string;
  dark_pool_grade: string;
  momentum: string;
}

interface MacroForecastData {
  leading: PredictiveSector[];
  lagging: PredictiveSector[];
}

interface InstData {
  source: string;
  ownershipSummary?: {
    SharesOutstandingPCT?: { label: string; value: string; }
    ShareoutstandingTotal?: { label: string; value: string; }
    TotalHoldingsValue?: { label: string; value: string; }
  };
  activePositions?: Array<{positions: string; holders: string; shares: string;}>;
  newSoldOutPositions?: Array<{positions: string; holders: string; shares: string;}>;
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


interface SectorRanking {
  sector: string;
  flow: number;
  max_flow: number;
}

interface MacroRotationData {
  lastFilingDate: string;
  nextUpdate?: string;
  rankings: SectorRanking[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";


function Top5Panel({ transactions, totalShares, quarter }: {
  transactions: any[];
  totalShares: number;
  quarter: string;
}) {
  const top5TotalShares = transactions.reduce(
    (acc: number, tx: any) => acc + (parseInt((tx.sharesHeld || '').replace(/,/g, '')) || 0),
    0
  );
  const top5CapPct = totalShares > 0
    ? ((top5TotalShares / totalShares) * 100).toFixed(3)
    : '—';

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Top 5 Institutional Holders</h3>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-neutral-600 font-mono">{quarter} filing</span>
          <span className="text-[10px] font-mono font-bold text-purple-400 border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 rounded">
            Top 5 = {top5CapPct}% of cap
          </span>
        </div>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-[9px] uppercase tracking-[0.15em] text-neutral-600 border-b border-neutral-800">
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
            const isPos = !tx.sharesChangePCT?.includes('-') && tx.sharesChangePCT !== '0%' && tx.sharesChangePCT !== 'New';
            const isNeg = Boolean(tx.sharesChangePCT?.includes('-'));
            const isNew = tx.sharesChangePCT === 'New';
            const shareCount = parseInt((tx.sharesHeld || '').replace(/,/g, '')) || 0;
            const capPct = totalShares > 0
              ? ((shareCount / totalShares) * 100).toFixed(3)
              : '—';
            const color = isPos || isNew ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-neutral-600';
            const bar = isPos || isNew ? 'bg-emerald-500' : isNeg ? 'bg-rose-500' : 'bg-neutral-700';
            return (
              <tr key={i} className="border-b border-neutral-800/40 hover:bg-white/[0.015] transition-colors group">
                <td className="py-2.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-0.5 h-4 rounded-full shrink-0 ${bar}`}></div>
                    <span className="text-[10px] font-bold text-neutral-300 truncate max-w-[110px] group-hover:text-white transition-colors" title={tx.ownerName}>{tx.ownerName}</span>
                  </div>
                </td>
                <td className="py-2.5 text-[10px] font-mono text-neutral-400 text-right">{tx.sharesHeld}</td>
                <td className="py-2.5 text-[11px] font-mono text-purple-400 text-right font-black">{capPct}%</td>
                <td className={`py-2.5 text-[10px] font-mono text-right font-bold ${color}`}>
                  {isPos || isNew ? '+' : ''}{tx.sharesChange}
                </td>
                <td className={`py-2.5 text-[10px] font-mono text-right font-bold ${color}`}>
                  {isNew ? <span className="px-1 py-0.5 bg-emerald-500/20 rounded text-[8px] uppercase">NEW</span> : tx.sharesChangePCT}
                </td>
                <td className="py-2.5 text-[10px] font-mono text-neutral-400 text-right">{tx.marketValue}</td>
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
  const [macroRotation, setMacroRotation] = useState<MacroRotationData | null>(null);
  const [macroForecast, setMacroForecast] = useState<MacroForecastData | null>(null);
  const [error, setError] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [instError, setInstError] = useState<string | null>(null);

  const fetchAnalysis = async (symbol: string, tf: string = timeframe) => {
    setLoading(true);
    setError("");
    setInstData(null);
    setInstError(null);
    try {
      const res = await fetch(`${API_URL}/api/analyze/${symbol}?timeframe=${encodeURIComponent(tf)}`);
      if (!res.ok) throw new Error("Ticker not supported or API offline");
      const result = await res.json();
      setData(result);
      
      try {
        const instRes = await fetch(`${API_URL}/api/institutional/${symbol}`);
        if (instRes.ok) {
          const iData = await instRes.json();
          setInstData(iData);
        } else {
          setInstData(null);
          setInstError(`Server returned status: ${instRes.status}`);
        }
      } catch (e: any) {
        console.error("Failed to fetch institutional data", e);
        setInstData(null);
        setInstError(e.message || "Failed to connect to backend");
      }
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Failed to load data");
      } else {
        setError("Failed to load data");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSectors = async () => {
    try {
      const res = await fetch(`${API_URL}/api/macro/rotation?t=${Date.now()}`);
      if (res.ok) setMacroRotation(await res.json());
      
      const fcRes = await fetch(`${API_URL}/api/macro/forecast?t=${Date.now()}`);
      if (fcRes.ok) setMacroForecast(await fcRes.json());
    } catch (e) {
      console.error("Failed to load macro sector rotation", e);
    }
  };

  const toggleWatchlist = (symbol: string) => {
    const upper = symbol.toUpperCase().trim();
    if (!upper) return;
    setWatchlist((prev) => {
      let next: string[];
      if (prev.includes(upper)) {
        next = prev.filter((item) => item !== upper);
      } else {
        next = [...prev, upper];
      }
      localStorage.setItem("quant_watchlist", JSON.stringify(next));
      return next;
    });
  };

  const getSectorTicker = (sector: string): string => {
    const s = sector.toLowerCase().trim();
    if (s.includes("tech")) return "XLK";
    if (s.includes("comm")) return "XLC";
    if (s.includes("health")) return "XLV";
    if (s.includes("finan")) return "XLF";
    if (s.includes("staple")) return "XLP";
    if (s.includes("indus")) return "XLI";
    if (s.includes("energ")) return "XLE";
    if (s.includes("mater")) return "XLB";
    if (s.includes("util")) return "XLU";
    if (s.includes("real") || s.includes("estate")) return "XLRE";
    if (s.includes("disc") || s.includes("discretionary")) return "XLY";
    return "SPY";
  };

  const handleSectorClick = (sector: string) => {
    const targetTicker = getSectorTicker(sector);
    setTicker(targetTicker);
    fetchAnalysis(targetTicker);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    fetchAnalysis("SPY", "1d");
    fetchSectors();
    const stored = localStorage.getItem("quant_watchlist");
    if (stored) {
      try {
        setWatchlist(JSON.parse(stored));
      } catch (e) {
        setWatchlist(["SPY", "QQQ", "AAPL", "SMCI"]);
      }
    } else {
      const defaultWatchlist = ["SPY", "QQQ", "AAPL", "SMCI"];
      setWatchlist(defaultWatchlist);
      localStorage.setItem("quant_watchlist", JSON.stringify(defaultWatchlist));
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker.trim()) {
      fetchAnalysis(ticker.trim().toUpperCase(), timeframe);
    }
  };



  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col">
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-purple-600 flex items-center justify-center font-bold text-white tracking-wider">Ω</div>
          <span className="text-lg font-semibold tracking-tight text-neutral-200">truecharts</span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-sm px-2 py-0.5 rounded font-mono border ${
            data ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20"
          }`}>
            API: {data ? "Connected" : "Disconnected"}
          </span>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-[125rem] w-full mx-auto flex flex-col lg:grid lg:grid-cols-5 gap-6 lg:items-start">
        
        <div className="contents lg:flex lg:flex-col lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:row-span-2 gap-6 w-full">
          
          <div className="order-1 lg:order-none bg-neutral-900 border border-neutral-800 rounded-lg p-5 w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Select Ticker</h2>
              {loading && (
                <span className="flex items-center gap-1.5 text-[11px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                  loading...
                </span>
              )}
            </div>
            <form onSubmit={handleSearch} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] text-neutral-500 uppercase font-bold mb-1">Symbol</label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono uppercase"
                  placeholder="e.g., AAPL"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-500 uppercase font-bold mb-1">Timeframe</label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-sans"
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
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-semibold text-sm py-2 rounded transition-colors mt-1"
              >
                {loading ? "loading..." : "Analyze Ticker"}
              </button>
            </form>
            {error && <p className="text-red-400 text-xs mt-2 font-mono">{error}</p>}
          </div>

          <div className="order-3 lg:order-none bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col gap-4 w-full">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Options Positioning</h2>
            <div className="flex justify-between items-center py-2 border-b border-neutral-800">
              <span className="text-neutral-400 text-sm">Put/Call Ratio</span>
              <span className="font-mono text-neutral-100 text-sm font-semibold">{data ? data.put_call_ratio : "-"}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-neutral-400 text-sm">Volatility Regime</span>
              <span className="font-mono text-neutral-100 text-sm font-semibold">{data ? data.iv_regime : "-"}</span>
            </div>
          </div>

          <div className="order-4 lg:order-none bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col w-full">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                13F Sector Flows
              </h2>
              {macroRotation && (
                <span className="text-[9px] text-purple-400 border border-purple-500/30 bg-purple-500/10 px-2 py-1 rounded font-mono uppercase tracking-widest">
                  Next 13F update: {macroRotation.nextUpdate || "~Aug 14"}
                </span>
              )}
            </div>
            
            <div className="flex flex-col gap-3">
              {macroRotation?.rankings?.map((sec, idx) => {
                const isBullish = sec.flow > 0;
                const progressWidth = `${(Math.abs(sec.flow) / sec.max_flow) * 100}%`;
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => handleSectorClick(sec.sector)}
                    className="flex items-center gap-3 cursor-pointer hover:bg-neutral-800/80 transition-all rounded py-1 px-1.5 -mx-1.5"
                    title={`Click to load ${getSectorTicker(sec.sector)} (${sec.sector} ETF benchmark) on chart`}
                  >
                    <span className="text-[11px] font-mono font-bold text-neutral-300 w-28 shrink-0 truncate">{sec.sector}</span>
                    <div className="flex-1 bg-neutral-950/50 rounded h-3 border border-neutral-800 relative overflow-hidden flex items-center">
                      {isBullish ? (
                        <div 
                          className="h-full bg-emerald-500/30 border-r border-emerald-500/60 transition-all duration-1000" 
                          style={{ width: progressWidth, left: 0, position: "absolute" }} 
                        />
                      ) : (
                        <div 
                          className="h-full bg-rose-500/30 border-l border-rose-500/60 transition-all duration-1000" 
                          style={{ width: progressWidth, right: 0, position: "absolute" }} 
                        />
                      )}
                    </div>
                    <span className={`text-[10px] font-mono font-bold w-12 text-right shrink-0 ${isBullish ? "text-emerald-400" : "text-rose-400"}`}>
                      {isBullish ? "+" : ""}{sec.flow}B
                    </span>
                  </div>
                );
              })}
            </div>

            {macroForecast && (
              <div className="mt-7 pt-5 border-t border-neutral-800/60">
                <h3 className="text-[11px] text-neutral-400 uppercase tracking-wider font-bold mb-4">Sector Predictions</h3>
                <div className="flex flex-col gap-4">
                  
                  {/* Leading Sectors */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-emerald-500/80 uppercase font-mono font-bold tracking-widest flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      Leading
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {macroForecast.leading?.map((item, i) => (
                        <div 
                          key={i} 
                          onClick={() => handleSectorClick(item.sector)}
                          className="bg-neutral-950 border border-emerald-900/40 p-3 rounded flex items-center justify-between cursor-pointer hover:border-emerald-500/80 hover:bg-emerald-950/10 transition-all"
                          title={`Click to load ${getSectorTicker(item.sector)} on chart`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-emerald-400">{item.sector}</span>
                            <span className="text-[9px] text-emerald-200/50 uppercase tracking-wider">{item.momentum}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] text-neutral-600 font-mono uppercase">Opt Flow</span>
                              <span className="text-[11px] font-bold text-emerald-300 font-mono">{item.options_grade}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] text-neutral-600 font-mono uppercase">Dark Pool</span>
                              <span className="text-[11px] font-bold text-emerald-300 font-mono">{item.dark_pool_grade}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lagging Sectors */}
                  <div className="flex flex-col gap-2 mt-2">
                    <span className="text-[10px] text-rose-500/80 uppercase font-mono font-bold tracking-widest flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                      Lagging
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {macroForecast.lagging?.map((item, i) => (
                        <div 
                          key={i} 
                          onClick={() => handleSectorClick(item.sector)}
                          className="bg-neutral-950 border border-rose-900/40 p-3 rounded flex items-center justify-between cursor-pointer hover:border-rose-500/80 hover:bg-rose-950/10 transition-all"
                          title={`Click to load ${getSectorTicker(item.sector)} on chart`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-rose-400">{item.sector}</span>
                            <span className="text-[9px] text-rose-200/50 uppercase tracking-wider">{item.momentum}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] text-neutral-600 font-mono uppercase">Opt Flow</span>
                              <span className="text-[11px] font-bold text-rose-300 font-mono">{item.options_grade}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] text-neutral-600 font-mono uppercase">Dark Pool</span>
                              <span className="text-[11px] font-bold text-rose-300 font-mono">{item.dark_pool_grade}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle Column Wrapper */}
        <div className="order-2 lg:order-none lg:col-span-3 lg:col-start-2 lg:row-start-1 lg:row-span-2 flex flex-col gap-6 w-full h-full min-h-0">
          
          {/* Main Chart Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 flex-1 flex flex-col w-full min-h-[520px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-white tracking-tight">{data?.ticker || ticker}</h1>
                  <button
                    onClick={() => toggleWatchlist(data?.ticker || ticker)}
                    className="p-1 transition-colors"
                    title={watchlist.includes((data?.ticker || ticker).toUpperCase()) ? "Remove from watchlist" : "Add to watchlist"}
                  >
                    <svg
                      className={`w-5 h-5 transition-all ${
                        watchlist.includes((data?.ticker || ticker).toUpperCase())
                          ? "text-neutral-100"
                          : "text-neutral-600 hover:text-neutral-300"
                      }`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-neutral-500 font-mono text-lg mt-1">{data?.name && data.name !== data.ticker ? data.name : ""}</p>
              </div>
            </div>

            <div className="flex-1 min-h-[440px] flex flex-col relative">
              {data ? (
                <TradingViewChart
                  ticker={data.ticker}
                  spot={data.spot}
                  maxPain={data.max_pain}
                  supports={data.supports}
                  resistances={data.resistances}
                  timeframe={timeframe}
                />
              ) : (
                <div className="flex-1 w-full bg-neutral-950 rounded flex items-center justify-center border border-neutral-850">
                  <span className="text-sm text-neutral-500 font-mono">{loading ? "loading..." : "Select a ticker to load the interactive chart"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Institutional Positioning Panel */}
          <div className="order-4 lg:order-none lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col w-full shrink-0 gap-5">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-[0.18em]">Institutional Positioning</h2>
                <p className="text-[10px] text-neutral-600 mt-0.5 font-mono">13F Flow Analysis · Nasdaq API · Hedge-Fund Grade</p>
              </div>
              <div className="flex items-center gap-2">
                {instData?.quarters && (
                  <span className="text-[9px] font-mono text-neutral-400 border border-neutral-800 bg-neutral-950 px-2.5 py-1 rounded">
                    3-Qtr Analysis · {instData.quarters.q2} → {instData.quarters.current}
                  </span>
                )}
                {instData?.source && (
                  <span className="text-[9px] font-mono px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-wider">13F Live</span>
                )}
              </div>
            </div>

            {instData && (instData.ownershipSummary || instData.history) ? (
              <div className="flex flex-col gap-5">

                {/* ── TOP 3 KPI CARDS: WhaleWisdom Filters ── */}
                {instData.history && instData.history.length >= 3 && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex flex-col gap-2">
                      <span className="text-[9px] text-neutral-500 font-semibold uppercase tracking-[0.18em]">Active Funds</span>
                      <span className="text-3xl font-mono font-black text-blue-400 leading-none">{instData.history[0].activeFunds.toLocaleString()}</span>
                      {instData.qoq && (
                        <span className="text-[10px] text-neutral-500 font-mono">
                          Prior: {instData.history[1].activeFunds.toLocaleString()} (
                          <span className={(instData.qoq.activeFunds_q0_vs_q1 ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {(instData.qoq.activeFunds_q0_vs_q1 ?? 0) >= 0 ? '+' : ''}{instData.qoq.activeFunds_q0_vs_q1?.toFixed(1) ?? '—'}%
                          </span>
                          )
                        </span>
                      )}
                    </div>
                    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex flex-col gap-2">
                      <span className="text-[9px] text-neutral-500 font-semibold uppercase tracking-[0.18em]">Hedge Funds</span>
                      <span className="text-3xl font-mono font-black text-purple-400 leading-none">{instData.history[0].hedgeFunds?.toLocaleString() ?? '—'}</span>
                      {instData.qoq && (
                        <span className="text-[10px] text-neutral-500 font-mono">
                          Prior: {instData.history[1].hedgeFunds?.toLocaleString() ?? '—'} (
                          <span className={(instData.qoq.hedgeFunds_q0_vs_q1 ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {(instData.qoq.hedgeFunds_q0_vs_q1 ?? 0) >= 0 ? '+' : ''}{instData.qoq.hedgeFunds_q0_vs_q1?.toFixed(1) ?? '—'}%
                          </span>
                          )
                        </span>
                      )}
                    </div>
                    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex flex-col gap-2">
                      <span className="text-[9px] text-neutral-500 font-semibold uppercase tracking-[0.18em]">In Top 10</span>
                      <span className="text-3xl font-mono font-black text-emerald-400 leading-none">{instData.history[0].top10 ?? '—'}</span>
                      {instData.qoq && (
                        <span className="text-[10px] text-neutral-500 font-mono">
                          Prior: {instData.history[1].top10 ?? '—'} (
                          <span className={(instData.qoq.top10_q0_vs_q1 ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {(instData.qoq.top10_q0_vs_q1 ?? 0) >= 0 ? '+' : ''}{instData.qoq.top10_q0_vs_q1?.toFixed(1) ?? '—'}%
                          </span>
                          )
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ── DERIVED 13F FLOW SIGNALS ── */}
                {instData.analytics && (
                  <div className="bg-gradient-to-br from-indigo-950/40 to-neutral-950 border border-indigo-900/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
                      <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.2em]">Derived 13F Flow Signals · {instData.quarters?.current}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase font-mono tracking-wider block mb-1">Inst. Accumulation</span>
                        <span className="text-2xl font-black text-indigo-400 font-mono leading-none">{instData.analytics.instAccumulation.toFixed(2)}x</span>
                        <span className="text-[9px] text-neutral-600 font-mono block mt-1">buy÷sell ratio</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase font-mono tracking-wider block mb-1">Net Fund Flow</span>
                        <span className={`text-2xl font-black font-mono leading-none ${instData.analytics.netFundFlow > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {instData.analytics.netFundFlow > 0 ? '+' : ''}{instData.analytics.netFundFlow}
                        </span>
                        <span className="text-[9px] text-neutral-600 font-mono block mt-1">funds net</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase font-mono tracking-wider block mb-1">Net Share Flow</span>
                        <span className={`text-2xl font-black font-mono leading-none ${instData.analytics.netShareFlow > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {instData.analytics.netShareFlow > 0 ? '+' : ''}{(Math.abs(instData.analytics.netShareFlow) / 1_000_000).toFixed(1)}M
                        </span>
                        {(instData.totalSharesOutstanding ?? 0) > 0 && (
                          <span className="text-[9px] text-neutral-600 font-mono block mt-1">
                            {((instData.analytics.netShareFlow / (instData.totalSharesOutstanding ?? 1)) * 100).toFixed(3)}% of cap
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase font-mono tracking-wider block mb-1">Qtr Turnover</span>
                        <span className="text-2xl font-black text-amber-400 font-mono leading-none">{(instData.analytics.totalTurnoverShares / 1_000_000).toFixed(1)}M</span>
                        {(instData.totalSharesOutstanding ?? 0) > 0 && (
                          <span className="text-[9px] text-neutral-600 font-mono block mt-1">
                            {((instData.analytics.totalTurnoverShares / (instData.totalSharesOutstanding ?? 1)) * 100).toFixed(2)}% rotated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── FUND ACTIVITY + HOLDINGS TABLE (2 columns) ── */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                  {/* Fund Activity Breakdown */}
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex flex-col gap-3">
                    <h3 className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Fund Activity Breakdown</h3>
                    <div className="flex flex-col divide-y divide-neutral-800/50">
                      {[...(instData.activePositions || []), ...(instData.newSoldOutPositions || [])].filter(p => !p.positions.includes('Total')).map((pos, i) => {
                        const isPos = pos.positions.includes('Increased') || pos.positions.includes('New');
                        const isNeg = pos.positions.includes('Decreased') || pos.positions.includes('Sold');
                        const shareCount = parseInt(pos.shares.replace(/,/g, '')) || 0;
                        const capPct = (instData.totalSharesOutstanding ?? 0) > 0
                          ? ((shareCount / (instData.totalSharesOutstanding ?? 1)) * 100).toFixed(3)
                          : '—';
                        return (
                          <div key={i} className="flex items-center justify-between py-2.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${isPos ? 'bg-emerald-500' : isNeg ? 'bg-rose-500' : 'bg-neutral-500'}`}></div>
                              <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{pos.positions}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className={`text-base font-mono font-black ${isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-neutral-300'}`}>{pos.holders}</span>
                              <span className="text-[9px] text-neutral-500 font-mono">{pos.shares} sh · <span className="text-neutral-600">{capPct}% of cap</span></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* WhaleWisdom-Style 3-Quarter Comparative Matrix */}
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Institutional Filings · 3-Quarter History</h3>
                      <span className="text-[9px] font-mono text-purple-400 font-bold uppercase">WhaleWisdom Quality Filtered</span>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[9px] uppercase tracking-[0.15em] text-neutral-600 border-b border-neutral-800">
                          <th className="pb-2 font-semibold">13F Metric</th>
                          <th className="pb-2 font-semibold text-right">{instData.quarters?.current}</th>
                          <th className="pb-2 font-semibold text-right">QoQ Change</th>
                          <th className="pb-2 font-semibold text-right">{instData.quarters?.q1}</th>
                          <th className="pb-2 font-semibold text-right">QoQ Change</th>
                          <th className="pb-2 font-semibold text-right">{instData.quarters?.q2}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Funds Holding", q0: instData.history?.[0]?.activeFunds, q1: instData.history?.[1]?.activeFunds, q2: instData.history?.[2]?.activeFunds, qoq1: instData.qoq?.activeFunds_q0_vs_q1, qoq2: instData.qoq?.activeFunds_q1_vs_q2, fmt: (v: number) => v.toLocaleString() },
                          { label: "Hedge Funds Holding", q0: instData.history?.[0]?.hedgeFunds, q1: instData.history?.[1]?.hedgeFunds, q2: instData.history?.[2]?.hedgeFunds, qoq1: instData.qoq?.hedgeFunds_q0_vs_q1, qoq2: instData.qoq?.hedgeFunds_q1_vs_q2, fmt: (v: number) => v.toLocaleString() },
                          { label: "In Top 10 Positions", q0: instData.history?.[0]?.top10, q1: instData.history?.[1]?.top10, q2: instData.history?.[2]?.top10, qoq1: instData.qoq?.top10_q0_vs_q1, qoq2: instData.qoq?.top10_q1_vs_q2, fmt: (v: number) => v.toLocaleString() },
                          { label: "Increased Positions", q0: instData.history?.[0]?.increased, q1: instData.history?.[1]?.increased, q2: instData.history?.[2]?.increased, qoq1: instData.qoq?.increased_q0_vs_q1, qoq2: instData.qoq?.increased_q1_vs_q2, fmt: (v: number) => v.toLocaleString() },
                          { label: "Reduced Positions", q0: instData.history?.[0]?.reduced, q1: instData.history?.[1]?.reduced, q2: instData.history?.[2]?.reduced, qoq1: instData.qoq?.reduced_q0_vs_q1, qoq2: instData.qoq?.reduced_q1_vs_q2, fmt: (v: number) => v.toLocaleString() },
                          { label: "Closed Positions", q0: instData.history?.[0]?.closed, q1: instData.history?.[1]?.closed, q2: instData.history?.[2]?.closed, qoq1: instData.qoq?.closed_q0_vs_q1, qoq2: instData.qoq?.closed_q1_vs_q2, fmt: (v: number) => v.toLocaleString() },
                          { label: "% Ownership (Filtered)", q0: instData.history?.[0]?.ownershipPct, q1: instData.history?.[1]?.ownershipPct, q2: instData.history?.[2]?.ownershipPct, qoq1: instData.qoq?.ownership_q0_vs_q1, qoq2: instData.qoq?.ownership_q1_vs_q2, fmt: (v: number) => `${v.toFixed(2)}%` },
                          { label: "Total Shares Held", q0: instData.history?.[0]?.totalShares, q1: instData.history?.[1]?.totalShares, q2: instData.history?.[2]?.totalShares, qoq1: instData.qoq?.ownership_q0_vs_q1, qoq2: instData.qoq?.ownership_q1_vs_q2, fmt: (v: number) => `${(v / 1_000_000).toFixed(1)}M` },
                          { label: "Holdings Value", q0: instData.history?.[0]?.totalValue, q1: instData.history?.[1]?.totalValue, q2: instData.history?.[2]?.totalValue, qoq1: instData.qoq?.totalValue_q0_vs_q1, qoq2: instData.qoq?.totalValue_q1_vs_q2, fmt: (v: number) => `$${(v / 1000).toFixed(2)}B` }
                        ].map((row, idx) => {
                          const hasQoq1 = row.qoq1 !== undefined;
                          const hasQoq2 = row.qoq2 !== undefined;
                          const isPos1 = (row.qoq1 ?? 0) >= 0;
                          const isPos2 = (row.qoq2 ?? 0) >= 0;
                          return (
                            <tr key={idx} className="border-b border-neutral-800/40 hover:bg-neutral-900/10">
                              <td className="py-2.5 text-xs font-semibold text-neutral-300">{row.label}</td>
                              <td className="py-2.5 text-right font-mono text-xs font-black text-neutral-100">{row.q0 !== undefined ? row.fmt(row.q0) : '—'}</td>
                              <td className="py-2.5 text-right font-mono text-[10px] font-bold">
                                {hasQoq1 ? (
                                  <span className={isPos1 ? 'text-emerald-400' : 'text-rose-400'}>
                                    {isPos1 ? '+' : ''}{row.qoq1?.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-neutral-600">—</span>
                                )}
                              </td>
                              <td className="py-2.5 text-right font-mono text-xs font-bold text-neutral-400">{row.q1 !== undefined ? row.fmt(row.q1) : '—'}</td>
                              <td className="py-2.5 text-right font-mono text-[10px] font-bold">
                                {hasQoq2 ? (
                                  <span className={isPos2 ? 'text-emerald-400' : 'text-rose-400'}>
                                    {isPos2 ? '+' : ''}{row.qoq2?.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-neutral-600">—</span>
                                )}
                              </td>
                              <td className="py-2.5 text-right font-mono text-xs text-neutral-500">{row.q2 !== undefined ? row.fmt(row.q2) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── TOP 5 INSTITUTIONAL TRANSACTIONS ── */}
                {instData.holdingsTransactions && instData.holdingsTransactions.length > 0 && (
                  <Top5Panel
                    transactions={instData.holdingsTransactions.slice(0, 5)}
                    totalShares={instData.totalSharesOutstanding ?? 0}
                    quarter={instData.quarters?.current ?? ''}
                  />
                )}

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 border border-neutral-800 border-dashed rounded-lg p-5 text-center gap-2">
                <span className="text-neutral-500 text-sm">{loading ? 'Loading 13F data…' : 'No institutional data'}</span>
                {!loading && (
                  <div className="text-[10px] font-mono text-neutral-600 border border-neutral-800 bg-neutral-950 px-3 py-2 rounded max-w-full flex flex-col gap-1 text-left">
                    <div><span className="text-neutral-500">Query URL:</span> <span className="text-blue-400 font-bold">{API_URL}/api/institutional/{symbol}</span></div>
                    {instError && <div><span className="text-neutral-500">Error:</span> <span className="text-rose-400">{instError}</span></div>}
                    <div className="text-[9px] text-neutral-600 mt-1 italic">To fix this, check that your NEXT_PUBLIC_API_URL environment variable in Vercel is set to your production backend domain.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="order-6 lg:order-none lg:col-span-1 lg:col-start-5 lg:row-start-1 lg:row-span-2 bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col w-full h-full min-h-[400px]">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Watchlist</h2>
          <div className="flex-1 flex flex-col min-h-0">
            {watchlist.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-4 border border-dashed border-neutral-800 rounded bg-neutral-950/20 text-center">
                <span className="text-xs text-neutral-500 font-mono">No favorited stocks. Click the tick icon next to the chart ticker to add.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[500px] pr-1">
                {watchlist.map((item) => (
                  <div
                    key={item}
                    onClick={() => { setTicker(item); fetchAnalysis(item); }}
                    className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-all ${
                      (data?.ticker || ticker).toUpperCase() === item.toUpperCase()
                        ? "bg-purple-950/25 border-purple-500/40 text-neutral-100"
                        : "bg-neutral-950 border-neutral-850/70 hover:bg-neutral-850/50 text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        (data?.ticker || ticker).toUpperCase() === item.toUpperCase() ? "bg-purple-500 animate-pulse" : "bg-neutral-700"
                      }`} />
                      <span className="font-mono font-bold text-sm tracking-wide">{item}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWatchlist(item); }}
                      className="text-neutral-400 hover:text-white transition-colors p-1"
                      title="Remove from Watchlist"
                    >
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


        <div className="order-6 lg:order-none lg:col-span-1 lg:col-start-5 lg:row-start-1 lg:row-span-2 bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col w-full h-full min-h-[400px]">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Watchlist</h2>
          <div className="flex-1 flex flex-col min-h-0">
            {watchlist.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-4 border border-dashed border-neutral-800 rounded bg-neutral-950/20 text-center">
                <span className="text-xs text-neutral-500 font-mono">No favorited stocks. Click the tick icon next to the chart ticker to add.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[500px] pr-1">
                {watchlist.map((item) => (
                  <div
                    key={item}
                    onClick={() => { setTicker(item); fetchAnalysis(item); }}
                    className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-all ${
                      (data?.ticker || ticker).toUpperCase() === item.toUpperCase()
                        ? "bg-purple-950/25 border-purple-500/40 text-neutral-100"
                        : "bg-neutral-950 border-neutral-850/70 hover:bg-neutral-850/50 text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        (data?.ticker || ticker).toUpperCase() === item.toUpperCase() ? "bg-purple-500 animate-pulse" : "bg-neutral-700"
                      }`} />
                      <span className="font-mono font-bold text-sm tracking-wide">{item}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWatchlist(item); }}
                      className="text-neutral-400 hover:text-white transition-colors p-1"
                      title="Remove from Watchlist"
                    >
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
