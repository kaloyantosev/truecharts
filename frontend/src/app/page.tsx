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
  quarterLabels: {
    current: string;
    last: string;
    prev: string;
  };
  darkPool?: {
    currentQ: string;
    lastQ: string;
    prevQ: string;
    pctChange: string;
  };
  hedgeFunds: {
    prevQ: number;
    lastQ: number;
    currentQ: number;
    pctCount: string;
    capitalPrevQ: string;
    capitalLastQ: string;
    capitalCurrentQ: string;
    pctCap: string;
  };
  totalFunds: {
    prevQ: number;
    lastQ: number;
    currentQ: number;
    pctCount: string;
    capitalPrevQ: string;
    capitalLastQ: string;
    capitalCurrentQ: string;
    pctCap: string;
  };
  sentimentFlow?: {
    netFlowCurrentQ: string;
    netFlowLastQ: string;
    netFlowPrevQ: string;
    netFlowPctChange: string;
    netCapitalFlowPctMcap?: number;
    netCapitalFlowLastPctMcap?: number;
  };
  ownership?: {
    institutionsPct: number;
    institutionsPctChange: number;
    insiderPct: number;
    insiderPctChange: number;
    topHolderConcentration: number;
    topHolderConcentrationLast: number;
    topHolderConcentrationChange: number;
    activePassive?: string;
    holdTime?: number;
    putCallRatio?: number;
    longOnlyCount?: number;
    shortOnlyCount?: number;
    longShortCount?: number;
    shortFloatPct?: number;
    daysToCover?: number;
    avgPortAlloc?: number;
    avgPortAllocChange?: number;
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

  const fetchAnalysis = async (symbol: string, tf: string = timeframe) => {
    setLoading(true);
    setError("");
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
        }
      } catch (e) {
        console.error("Failed to fetch institutional data", e);
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

  const renderStat = (
    title: string,
    current: number | string,
    last: number | string,
    prev: number | string,
    pct: string | undefined,
    labels: InstData["quarterLabels"],
    currentSubDetail?: React.ReactNode,
    lastSubDetail?: React.ReactNode
  ) => {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{title}</h3>
        <div className="grid grid-cols-3 w-full">
          <div className="flex flex-col pr-6 border-r border-neutral-800 opacity-50">
            <span className="text-2xl font-mono font-bold text-neutral-500 leading-none">{prev}</span>
            <span className="text-[10px] text-neutral-600 font-mono uppercase mt-1">[{labels.prev}]</span>
          </div>
          <div className="flex flex-col px-6 border-r border-neutral-800 opacity-80">
            <span className="text-2xl font-mono font-bold text-neutral-400 leading-none">{last}</span>
            <span className="text-[10px] text-neutral-500 font-mono uppercase mt-1">[{labels.last}]</span>
            {lastSubDetail && <div className="mt-0.5">{lastSubDetail}</div>}
          </div>
          <div className="flex flex-col pl-6">
            <span className="text-2xl font-mono font-bold text-white leading-none">{current}</span>
            <span className="text-[10px] text-neutral-400 font-mono uppercase mt-1">[{labels.current}]</span>
            {currentSubDetail && <div className="mt-0.5">{currentSubDetail}</div>}
            {pct && (
              <span className={`text-xs font-mono font-bold flex items-center mt-1 ${parseFloat(pct) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {parseFloat(pct) >= 0 ? "▲" : "▼"} {Math.abs(parseFloat(pct))}% Q/Q
              </span>
            )}
          </div>
        </div>
      </div>
    );
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
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 flex flex-col w-full shrink-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Institutional Positioning</h2>
                <p className="text-xs text-neutral-500 mt-0.5">Top 10 Institutional Holders & Total 13F allocation based on public exchange disclosures</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-purple-300 border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 rounded font-mono uppercase tracking-widest font-bold shadow-sm">
                  Next 13F Update: ~Aug 14
                </span>
                <span className="text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 rounded font-mono uppercase tracking-widest font-bold shadow-sm">
                  As of {macroRotation?.lastFilingDate || "May 15"}
                </span>
              </div>
            </div>

          {instData ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-neutral-950 border border-neutral-850 rounded-lg p-5 flex flex-col gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <h3 className="text-sm font-bold text-neutral-200">Top 10 13F Holders</h3>
                  </div>
                  <div className="space-y-6">
                    {renderStat("Major Holders (Count)", instData.hedgeFunds.currentQ, instData.hedgeFunds.lastQ, instData.hedgeFunds.prevQ, instData.hedgeFunds.pctCount, instData.quarterLabels)}
                    <div className="pt-5 border-t border-neutral-900">
                      {renderStat("Top 10 Invested", instData.hedgeFunds.capitalCurrentQ, instData.hedgeFunds.capitalLastQ, instData.hedgeFunds.capitalPrevQ, instData.hedgeFunds.pctCap, instData.quarterLabels)}
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-950 border border-neutral-850 rounded-lg p-5 flex flex-col gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <h3 className="text-sm font-bold text-neutral-200">All 13F Institutions</h3>
                  </div>
                  <div className="space-y-6">
                    {renderStat("Total Filers (Count)", instData.totalFunds.currentQ, instData.totalFunds.lastQ, instData.totalFunds.prevQ, instData.totalFunds.pctCount, instData.quarterLabels)}
                    <div className="pt-5 border-t border-neutral-900">
                      {renderStat("Total Invested", instData.totalFunds.capitalCurrentQ, instData.totalFunds.capitalLastQ, instData.totalFunds.capitalPrevQ, instData.totalFunds.pctCap, instData.quarterLabels)}
                    </div>
                  </div>
                </div>
              </div>

              {instData.sentimentFlow && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Net Capital Flow */}
                  <div className="bg-neutral-950 border border-neutral-850 rounded-lg p-5 flex flex-col justify-center">
                    {renderStat(
                      "Quarterly Net Capital Flow", 
                      instData.sentimentFlow.netFlowCurrentQ, 
                      instData.sentimentFlow.netFlowLastQ, 
                      instData.sentimentFlow.netFlowPrevQ, 
                      instData.sentimentFlow.netFlowPctChange, 
                      instData.quarterLabels,
                      instData.sentimentFlow.netCapitalFlowPctMcap !== undefined ? <span className="text-[10px] font-mono font-bold text-neutral-400 whitespace-nowrap">{instData.sentimentFlow.netCapitalFlowPctMcap.toFixed(1)}% of M.Cap</span> : undefined,
                      instData.sentimentFlow.netCapitalFlowLastPctMcap !== undefined ? <span className="text-[10px] font-mono font-bold text-neutral-500 whitespace-nowrap">{instData.sentimentFlow.netCapitalFlowLastPctMcap.toFixed(1)}% of M.Cap</span> : undefined
                    )}
                  </div>

                  {/* Dark Pool Activity -> Off-Exchange Vol */}
                  {instData.darkPool && (
                    <div className="bg-neutral-950 border border-neutral-850 rounded-lg p-5 flex flex-col justify-center">
                      {renderStat("Off-Exchange / Dark Pool Vol", instData.darkPool.currentQ, instData.darkPool.lastQ, instData.darkPool.prevQ, instData.darkPool.pctChange, instData.quarterLabels)}
                    </div>
                  )}
                </div>
              )}

              {instData.ownership && (
                <div className="bg-neutral-950 border border-neutral-850 rounded-lg p-6 flex flex-col gap-8">
                  
                  {/* Top: Ownership Distribution (Float) */}
                  <div className="flex flex-col gap-6">
                    <h3 className="text-sm font-bold text-neutral-300">Ownership Distribution (Float)</h3>

                    {/* 100% Segmented Bar */}
                    <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800 flex">
                      <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, instData.ownership.institutionsPct)}%` }}></div>
                      <div className="h-full bg-amber-500" style={{ width: `${Math.min(100 - instData.ownership.institutionsPct, instData.ownership.insiderPct)}%` }}></div>
                      <div className="h-full bg-neutral-700" style={{ width: `${Math.max(0, 100 - instData.ownership.institutionsPct - instData.ownership.insiderPct)}%` }}></div>
                    </div>

                    {/* Legend & Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                          <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Institutions</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-xl font-mono font-bold text-purple-400">{instData.ownership.institutionsPct.toFixed(1)}%</span>
                          {instData.ownership.institutionsPctChange !== undefined && (
                            <span className={`text-xs font-mono font-bold flex items-center ${instData.ownership.institutionsPctChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {instData.ownership.institutionsPctChange >= 0 ? "▲" : "▼"} {Math.abs(instData.ownership.institutionsPctChange).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                          <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Insiders</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-xl font-mono font-bold text-amber-400">{instData.ownership.insiderPct.toFixed(1)}%</span>
                          {instData.ownership.insiderPctChange !== undefined && (
                            <span className={`text-xs font-mono font-bold flex items-center ${instData.ownership.insiderPctChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {instData.ownership.insiderPctChange >= 0 ? "▲" : "▼"} {Math.abs(instData.ownership.insiderPctChange).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 sm:border-l sm:border-neutral-800 sm:pl-6">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-neutral-700"></div>
                          <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Public Float</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-xl font-mono font-bold text-neutral-400">
                            {Math.max(0, 100 - instData.ownership.institutionsPct - instData.ownership.insiderPct).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Hedge-Fund Intelligence (Fintel Analytics) */}
                  <div className="border-t border-neutral-850 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Hedge-Fund & Institutional Allocation Intelligence</span>
                      <span className="text-[10px] text-neutral-500 font-mono">SOURCE: FINTEL / SEC 13F / FINRA</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      
                      {/* Whale Concentration */}
                      <div className="bg-neutral-900/60 border border-neutral-850/80 rounded p-4 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Whale Concentration</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-mono font-bold text-white leading-none">{instData.ownership.topHolderConcentration.toFixed(1)}%</span>
                          {instData.ownership.topHolderConcentrationChange !== undefined && (
                            <span className={`whitespace-nowrap text-xs font-mono font-bold flex items-center ${instData.ownership.topHolderConcentrationChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {instData.ownership.topHolderConcentrationChange >= 0 ? "▲" : "▼"} {Math.abs(instData.ownership.topHolderConcentrationChange).toFixed(1)}% Q/Q
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-500 mt-1 font-mono">Top 10 Holder Allocation (13F/NPORT)</span>
                      </div>

                      {/* Active vs Passive Split */}
                      <div className="bg-neutral-900/60 border border-neutral-850/80 rounded p-4 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Active / Passive Split</span>
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-mono font-bold text-white leading-none">{instData.ownership.activePassive?.split('/')[0] || "68%"}</span>
                            <span className="text-xs font-mono text-neutral-500 font-bold">Active</span>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-mono font-bold text-neutral-400 leading-none">{instData.ownership.activePassive?.split('/')[1] || "32%"}</span>
                            <span className="text-xs font-mono text-neutral-500 font-bold">Passive</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-neutral-500 mt-1 font-mono">13F Managers vs NPORT ETFs</span>
                      </div>

                      {/* Avg Portfolio Allocation */}
                      {instData.ownership.avgPortAlloc !== undefined && (
                        <div className="bg-neutral-900/60 border border-neutral-850/80 rounded p-4 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Avg Port Allocation</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-mono font-bold text-white leading-none">{instData.ownership.avgPortAlloc.toFixed(2)}%</span>
                            {instData.ownership.avgPortAllocChange !== undefined && (
                              <span className={`whitespace-nowrap text-xs font-mono font-bold flex items-center ${instData.ownership.avgPortAllocChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {instData.ownership.avgPortAllocChange >= 0 ? "▲" : "▼"} {Math.abs(instData.ownership.avgPortAllocChange).toFixed(0)}% MRQ
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-500 mt-1 font-mono">Avg Weight in Institutional Portfolios</span>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6 w-full animate-pulse">
              {/* 4-Card Grid Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-neutral-950/80 border border-neutral-850/80 rounded-lg p-5 flex flex-col gap-6 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500/40 animate-ping" />
                        <div className="h-4 w-32 bg-neutral-800/80 rounded" />
                      </div>
                      <div className="h-3 w-16 bg-neutral-850 rounded" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-2">
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className="flex flex-col gap-2">
                          <div className="h-7 w-20 bg-neutral-800/90 rounded" />
                          <div className="h-3 w-12 bg-neutral-850 rounded" />
                        </div>
                      ))}
                    </div>
                    <div className="pt-5 border-t border-neutral-900 flex justify-between items-center">
                      <div className="flex flex-col gap-2">
                        <div className="h-3 w-24 bg-neutral-850 rounded" />
                        <div className="h-6 w-28 bg-neutral-800/80 rounded" />
                      </div>
                      <div className="h-5 w-16 bg-purple-500/10 border border-purple-500/20 rounded" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Ownership Distribution Skeleton */}
              <div className="bg-neutral-950/80 border border-neutral-850/80 rounded-lg p-6 flex flex-col gap-8">
                <div className="flex flex-col gap-6">
                  <div className="h-4 w-48 bg-neutral-800/80 rounded" />
                  <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800 flex">
                    <div className="h-full w-1/3 bg-purple-500/30 animate-pulse" />
                    <div className="h-full w-1/4 bg-amber-500/30 animate-pulse" />
                    <div className="h-full w-5/12 bg-neutral-800/50 animate-pulse" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, k) => (
                      <div key={k} className="flex flex-col gap-2">
                        <div className="h-3 w-20 bg-neutral-850 rounded" />
                        <div className="h-7 w-24 bg-neutral-800/90 rounded" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Analytics Skeleton */}
                <div className="border-t border-neutral-850 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-3 w-64 bg-neutral-850 rounded" />
                    <div className="h-3 w-32 bg-neutral-900 rounded" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, m) => (
                      <div key={m} className="bg-neutral-900/30 border border-neutral-850/50 rounded p-4 flex flex-col justify-between h-24">
                        <div className="h-3 w-32 bg-neutral-800/80 rounded" />
                        <div className="h-7 w-20 bg-neutral-750/80 rounded" />
                        <div className="h-2 w-40 bg-neutral-850 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
