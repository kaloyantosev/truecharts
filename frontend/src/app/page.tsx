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

interface SectorInfo {
  etf: string;
  name: string;
  change: number;
  momentum: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Home() {
  const [ticker, setTicker] = useState("SPY");
  const [timeframe, setTimeframe] = useState("1d");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [instData, setInstData] = useState<any>(null);
  const [sectors, setSectors] = useState<SectorInfo[]>([]);
  const [macroForecast, setMacroForecast] = useState<any>(null);
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
      
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchSectors = async () => {
    try {
      const res = await fetch(`${API_URL}/api/macro/rotation`);
      if (res.ok) setSectors(await res.json());
      
      const fcRes = await fetch(`${API_URL}/api/macro/forecast`);
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

  const renderStat = (title: string, current: string | number, last: string | number, pct: string) => {
    const isPos = parseFloat(pct) >= 0;
    return (
      <div>
        <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1">{title}</p>
        <div className="flex items-end gap-3">
          <span className="text-2xl font-mono font-bold text-white">{current}</span>
          <div className="flex flex-col pb-0.5">
            <span className="text-[10px] text-neutral-400">vs {last} last Q</span>
            <span className={`text-xs font-mono font-bold flex items-center ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
              {isPos ? (
                <svg className="w-3 h-3 mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
              ) : (
                <svg className="w-3 h-3 mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>
              )}
              {isPos ? "+" : ""}{pct}%
            </span>
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

      <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto flex flex-col lg:grid lg:grid-cols-5 gap-6 lg:items-start">
        
        <div className="contents lg:flex lg:flex-col lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:row-span-2 gap-6 w-full">
          
          <div className="order-1 lg:order-none bg-neutral-900 border border-neutral-800 rounded-lg p-5 w-full">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Select Ticker</h2>
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
                </select>
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-semibold text-sm py-2 rounded transition-colors mt-1"
              >
                {loading ? "Analyzing..." : "Analyze Ticker"}
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
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              Macro Sector Rotation
              <span className="text-[10px] text-purple-500 font-mono font-normal lowercase bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">1w</span>
            </h2>
            <div className="grid grid-cols-4 gap-2.5 mt-2">
              {sectors.map((sec, idx) => {
                let colorClass = "bg-neutral-900 border-neutral-850 text-neutral-400";
                if (idx === 0) colorClass = "bg-emerald-900/80 border-emerald-500/70 text-emerald-100 hover:bg-emerald-800/80";
                else if (idx >= 1 && idx <= 3) colorClass = "bg-emerald-950/45 border-emerald-600/40 text-emerald-200 hover:bg-emerald-900/45";
                else if (idx >= 4 && idx <= 6) colorClass = "bg-emerald-950/20 border-emerald-800/20 text-emerald-300/80 hover:bg-emerald-900/25";
                else if (idx >= 7 && idx <= 9) colorClass = "bg-neutral-900/40 border-neutral-850 text-neutral-400 hover:bg-neutral-800/40";
                else if (idx >= 10 && idx <= 12) colorClass = "bg-rose-950/20 border-rose-800/20 text-rose-300/80 hover:bg-rose-900/25";
                else if (idx >= 13 && idx <= 14) colorClass = "bg-rose-950/45 border-rose-600/40 text-rose-200 hover:bg-rose-900/45";
                else if (idx === 15) colorClass = "bg-rose-900/80 border-rose-500/70 text-rose-100 hover:bg-rose-800/80";

                return (
                  <div
                    key={sec.etf}
                    onClick={() => { setTicker(sec.etf); fetchAnalysis(sec.etf); }}
                    className={`flex flex-col justify-between p-2 border rounded-lg cursor-pointer transition-all aspect-square text-center ${colorClass}`}
                  >
                    <div>
                      <div className="font-bold text-xs tracking-wider font-mono">{sec.etf}</div>
                      <div className="text-[9px] opacity-60 truncate mt-0.5">{sec.name}</div>
                    </div>
                    <div className="font-mono text-[10px] font-bold mt-auto pt-1">
                      {sec.change >= 0 ? "+" : ""}{sec.change.toFixed(2)}%
                    </div>
                  </div>
                );
              })}
            </div>

            {macroForecast && (
              <div className="mt-6 pt-5 border-t border-neutral-800/60">
                <h3 className="text-[11px] text-neutral-400 uppercase tracking-wider font-bold mb-4">Quarterly Macro Outlook</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[10px] text-emerald-500/80 uppercase font-mono font-bold tracking-widest flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      Bullish
                    </span>
                    {macroForecast.bullish.map((item: any, i: number) => (
                      <div key={i} className="bg-emerald-950/20 border border-emerald-900/30 p-2.5 rounded flex flex-col gap-1 hover:bg-emerald-950/40 transition-colors">
                        <span className="text-xs font-bold text-emerald-400 font-mono tracking-tight">{item.name}</span>
                        <span className="text-[10px] text-emerald-200/50 leading-tight">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[10px] text-rose-500/80 uppercase font-mono font-bold tracking-widest flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                      Bearish
                    </span>
                    {macroForecast.bearish.map((item: any, i: number) => (
                      <div key={i} className="bg-rose-950/20 border border-rose-900/30 p-2.5 rounded flex flex-col gap-1 hover:bg-rose-950/40 transition-colors">
                        <span className="text-xs font-bold text-rose-400 font-mono tracking-tight">{item.name}</span>
                        <span className="text-[10px] text-rose-200/50 leading-tight">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="order-2 lg:order-none lg:col-span-3 lg:col-start-2 lg:row-start-1 bg-neutral-900 border border-neutral-800 rounded-lg p-6 min-h-[520px] flex flex-col w-full">
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
              <p className="text-sm text-neutral-500">{data?.name || "Option metrics overlay & technical zones"}</p>
            </div>
          </div>

          <div className="flex-1 min-h-[440px]">
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
              <div className="w-full h-[320px] bg-neutral-950 rounded flex items-center justify-center border border-neutral-850">
                <span className="text-sm text-neutral-500 font-mono">Select a ticker to load the interactive chart</span>
              </div>
            )}
          </div>
        </div>

        <div className="order-5 lg:order-none lg:col-span-3 lg:col-start-2 lg:row-start-2 bg-neutral-900 border border-neutral-800 rounded-lg p-6 flex flex-col w-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Institutional Positioning</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Hedge Fund & Mutual Fund flows based on 13F public filings</p>
            </div>
            <span className="text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 rounded font-mono">LIVE API (yFinance)</span>
          </div>

          {instData ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-neutral-950 border border-neutral-850 rounded-lg p-5 flex flex-col gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <h3 className="text-sm font-bold text-neutral-200">Hedge Funds</h3>
                  </div>
                  <div className="space-y-5">
                    {renderStat("Total Invested (Count)", instData.hedgeFunds.currentQ, instData.hedgeFunds.lastQ, instData.hedgeFunds.pctCount)}
                    <div className="pt-4 border-t border-neutral-900">
                      {renderStat("Capital Invested", instData.hedgeFunds.capitalCurrentQ, instData.hedgeFunds.capitalLastQ, instData.hedgeFunds.pctCap)}
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-950 border border-neutral-850 rounded-lg p-5 flex flex-col gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <h3 className="text-sm font-bold text-neutral-200">Total Funds (All)</h3>
                  </div>
                  <div className="space-y-5">
                    {renderStat("Total Invested (Count)", instData.totalFunds.currentQ, instData.totalFunds.lastQ, instData.totalFunds.pctCount)}
                    <div className="pt-4 border-t border-neutral-900">
                      {renderStat("Capital Invested", instData.totalFunds.capitalCurrentQ, instData.totalFunds.capitalLastQ, instData.totalFunds.pctCap)}
                    </div>
                  </div>
                </div>
              </div>

              {instData.ownership && (
                <div className="bg-neutral-950 border border-neutral-850 rounded-lg p-6 flex flex-col gap-5">
                  <h3 className="text-sm font-bold text-neutral-300">Ownership Distribution</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    
                    <div className="flex flex-col justify-center">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Institutions</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-mono font-bold text-purple-400">{instData.ownership.institutionsPct}%</span>
                          {instData.ownership.institutionsPctChange !== undefined && (
                            <span className={`text-[10px] font-mono font-bold flex items-center ${instData.ownership.institutionsPctChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {instData.ownership.institutionsPctChange >= 0 ? "▲" : "▼"}{Math.abs(instData.ownership.institutionsPctChange)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, instData.ownership.institutionsPct)}%` }}></div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Insiders</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-mono font-bold text-amber-400">{instData.ownership.insiderPct}%</span>
                          {instData.ownership.insiderPctChange !== undefined && (
                            <span className={`text-[10px] font-mono font-bold flex items-center ${instData.ownership.insiderPctChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {instData.ownership.insiderPctChange >= 0 ? "▲" : "▼"}{Math.abs(instData.ownership.insiderPctChange)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, instData.ownership.insiderPct)}%` }}></div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center border-l border-neutral-850 pl-8">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1 font-bold">Top Holder Concentration</span>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-mono font-bold text-neutral-200">{instData.ownership.topHolderConcentration}%</span>
                          <span className="text-xs text-neutral-500 font-mono">of float</span>
                        </div>
                        {instData.ownership.topHolderConcentrationChange !== undefined && (
                            <span className={`text-[10px] font-mono font-bold flex items-center ${instData.ownership.topHolderConcentrationChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {instData.ownership.topHolderConcentrationChange >= 0 ? "▲" : "▼"}{Math.abs(instData.ownership.topHolderConcentrationChange)}% vs last Q
                            </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 border border-neutral-850 rounded-lg bg-neutral-950/40 text-center">
              <span className="text-sm text-neutral-500 font-mono animate-pulse">Loading Live Institutional Data...</span>
            </div>
          )}
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
