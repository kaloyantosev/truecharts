"use client";

import { useState, useEffect } from "react";
import TradingViewChart from "@/components/TradingViewChart";

interface TradeIdea {
  strategy: string;
  type: string;
  description: string;
  probability?: number;
  max_profit?: string;
  max_loss?: string;
  risk_reward?: string;
  stop_loss?: string;
  tp1?: string;
  tp2?: string;
}

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
  spot: number;
  max_pain: number;
  supports: Level[];
  resistances: Level[];
  trade_ideas: TradeIdea[];
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

const POPULAR_TICKERS = ["SPY", "QQQ", "AAPL", "SMCI", "NVDA", "TSLA", "MSFT", "AMD", "AMZN", "GOOGL"];

export default function Home() {
  const [ticker, setTicker] = useState("SPY");
  const [timeframe, setTimeframe] = useState("1d");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [sectors, setSectors] = useState<SectorInfo[]>([]);
  const [error, setError] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>([]);

  const [backtestStrategy, setBacktestStrategy] = useState("leveraged_futures");
  const [backtestData, setBacktestData] = useState<any>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  const fetchBacktest = async (symbol: string, strategy: string) => {
    setBacktestLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol, strategy }),
      });
      if (res.ok) {
        const result = await res.json();
        setBacktestData(result);
      }
    } catch (e) {
      console.error("Backtest failed", e);
    } finally {
      setBacktestLoading(false);
    }
  };

  const fetchAnalysis = async (symbol: string, tf: string = timeframe) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/analyze/${symbol}?timeframe=${encodeURIComponent(tf)}`);
      if (!res.ok) throw new Error("Ticker not supported or API offline");
      const result = await res.json();
      setData(result);
      // Automatically pull backtest for new symbol
      fetchBacktest(symbol, backtestStrategy);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchSectors = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/macro/rotation`);
      if (res.ok) {
        const result = await res.json();
        setSectors(result);
      }
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
    // Load watchlist from localStorage
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
      {/* Navigation Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-purple-600 flex items-center justify-center font-bold text-white tracking-wider">Ω</div>
          <span className="text-lg font-semibold tracking-tight text-neutral-200">QUANT<span className="text-purple-500">WORKSTATION</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-sm px-2 py-0.5 rounded font-mono border ${
            data ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20"
          }`}>
            API: {data ? "Connected" : "Disconnected"}
          </span>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Control & Analytics Column */}
        <section className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Ticker Selector */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
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

          {/* Quick Metrics */}
          {data && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Options Positioning</h2>
              
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400 text-sm">Spot Price</span>
                <span className="font-mono text-neutral-100 text-sm font-semibold">${data.spot.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400 text-sm">Max Pain</span>
                <span className="font-mono text-purple-400 text-sm font-semibold">${data.max_pain.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400 text-sm">Sentiment</span>
                <span className={`font-mono text-sm font-semibold ${data.sentiment === "Bullish" ? "text-emerald-400" : "text-rose-400"}`}>
                  {data.sentiment}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400 text-sm">Trend Phase</span>
                <span className="font-mono text-neutral-100 text-sm font-semibold">
                  {data.trend_phase}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400 text-sm">Put/Call Ratio</span>
                <span className="font-mono text-neutral-100 text-sm font-semibold">
                  {data.put_call_ratio}
                </span>
              </div>


              <div className="flex justify-between items-center py-2">
                <span className="text-neutral-400 text-sm">Volatility Regime</span>
                <span className="font-mono text-neutral-100 text-sm font-semibold">
                  {data.iv_regime}
                </span>
              </div>
            </div>
          )}

          {/* Sector Rotation Scanner */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex-1 flex flex-col">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              Macro Sector Rotation
              <span className="text-[10px] text-purple-500 font-mono font-normal lowercase bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">1w</span>
            </h2>
            <div className="grid grid-cols-4 gap-2.5 mt-2">
              {sectors.map((sec, idx) => {
                // Determine diagonal color skew based on index (sorted performance out of 16)
                let colorClass = "bg-neutral-900 border-neutral-850 text-neutral-400";
                
                if (idx === 0) {
                  colorClass = "bg-emerald-900/80 border-emerald-500/70 text-emerald-100 hover:bg-emerald-800/80";
                } else if (idx >= 1 && idx <= 3) {
                  colorClass = "bg-emerald-950/45 border-emerald-600/40 text-emerald-200 hover:bg-emerald-900/45";
                } else if (idx >= 4 && idx <= 6) {
                  colorClass = "bg-emerald-950/20 border-emerald-800/20 text-emerald-300/80 hover:bg-emerald-900/25";
                } else if (idx >= 7 && idx <= 9) {
                  colorClass = "bg-neutral-900/40 border-neutral-850 text-neutral-400 hover:bg-neutral-800/40";
                } else if (idx >= 10 && idx <= 12) {
                  colorClass = "bg-rose-950/20 border-rose-800/20 text-rose-300/80 hover:bg-rose-900/25";
                } else if (idx >= 13 && idx <= 14) {
                  colorClass = "bg-rose-950/45 border-rose-600/40 text-rose-200 hover:bg-rose-900/45";
                } else if (idx === 15) {
                  colorClass = "bg-rose-900/80 border-rose-500/70 text-rose-100 hover:bg-rose-800/80";
                }

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
          </div>
        </section>

        {/* Right Content Panels */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Main Chart Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 min-h-[520px] flex flex-col">
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
                <p className="text-sm text-neutral-500">Option metrics overlay & technical zones</p>
              </div>
            </div>

            {/* Interactive Chart */}
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

          {/* Trade Ideas Panel */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Setup</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data?.trade_ideas.map((idea, idx) => (
                <div key={idx} className="bg-neutral-950 border border-neutral-800/80 rounded p-4 flex flex-col justify-between">
                  <div>
                    <span className={`text-xs font-semibold tracking-wider uppercase font-mono ${
                      idea.type === "options" ? "text-purple-400" : "text-amber-500"
                    }`}>
                      {idea.type === "options" ? "Options" : "Leverage"}
                    </span>
                    <h3 className="text-white font-semibold mt-1">{idea.strategy}</h3>
                    <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">{idea.description}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-neutral-900 flex flex-wrap gap-y-1 items-center justify-between text-[11px] font-mono text-neutral-400">
                    {idea.type === "options" ? (
                      <>
                        <span>Max Profit: {idea.max_profit}</span>
                        <span>Prob: {idea.probability}%</span>
                      </>
                    ) : (
                      <>
                        <span>Stop: {idea.stop_loss}</span>
                        {idea.tp1 && <span>TP1: {idea.tp1}</span>}
                        {idea.tp2 && <span>TP2: {idea.tp2}</span>}
                        <span>R/R: {idea.risk_reward}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Backtesting Engine Panel */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Historical Backtest Simulator</h2>
                <p className="text-xs text-neutral-500 mt-0.5">Test leveraged long/short strategy based on GEX and S/R levels over 100 days</p>
              </div>
            </div>

            {backtestLoading ? (
              <div className="bg-neutral-950/45 border border-neutral-800 rounded-lg p-8 flex items-center justify-center">
                <span className="text-sm text-neutral-500 font-mono animate-pulse">Running quantitative backtest simulation...</span>
              </div>
            ) : backtestData ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Backtest Statistics */}
                <div className="lg:col-span-1 grid grid-cols-2 gap-4">
                  <div className="bg-neutral-950 border border-neutral-800 rounded p-3 flex flex-col justify-between">
                    <span className="text-neutral-500 text-[10px] uppercase font-semibold">Net Return</span>
                    <span className={`text-xl font-bold font-mono ${backtestData.net_return >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {backtestData.net_return >= 0 ? "+" : ""}{backtestData.net_return}%
                    </span>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800 rounded p-3 flex flex-col justify-between">
                    <span className="text-neutral-500 text-[10px] uppercase font-semibold">Win Rate</span>
                    <span className="text-xl font-bold font-mono text-neutral-200">{backtestData.win_rate}%</span>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800 rounded p-3 flex flex-col justify-between">
                    <span className="text-neutral-500 text-[10px] uppercase font-semibold">Sharpe Ratio</span>
                    <span className="text-xl font-bold font-mono text-purple-400">{backtestData.sharpe_ratio}</span>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800 rounded p-3 flex flex-col justify-between">
                    <span className="text-neutral-500 text-[10px] uppercase font-semibold">Max Drawdown</span>
                    <span className="text-xl font-bold font-mono text-rose-400">{backtestData.max_drawdown}%</span>
                  </div>
                </div>

                {/* Equity Curve Graph */}
                <div className="lg:col-span-2 bg-neutral-950 border border-neutral-800 rounded p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-neutral-400 text-xs font-semibold uppercase">Simulated Equity Curve</span>
                    <span className="text-[10px] text-neutral-600 font-mono">100 Days Lookback</span>
                  </div>
                  {/* Inline SVG Chart */}
                  <div className="w-full h-24 bg-neutral-950 rounded overflow-hidden flex items-end">
                    {backtestData.equity_curve && backtestData.equity_curve.length > 0 && (
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {(() => {
                          const curve = backtestData.equity_curve;
                          const min = Math.min(...curve);
                          const max = Math.max(...curve);
                          const range = max - min || 1;
                          const points = curve.map((val: number, idx: number) => {
                            const x = (idx / (curve.length - 1)) * 100;
                            const y = 90 - ((val - min) / range) * 80;
                            return `${x},${y}`;
                          }).join(" ");
                          return (
                            <>
                              <polyline fill="none" stroke="#a855f7" strokeWidth="1.5" points={points} />
                              <line x1="0" y1="90" x2="100" y2="90" stroke="#262626" strokeWidth="0.5" strokeDasharray="2,2" />
                            </>
                          );
                        })()}
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-950 border border-neutral-850 rounded-lg p-6 text-center">
                <span className="text-neutral-500 text-xs font-mono">No simulation loaded</span>
              </div>
            )}
          </div>
        </section>

        {/* Watchlist Panel */}
        <section className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col h-full min-h-[400px]">
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
                      onClick={() => {
                        setTicker(item);
                        fetchAnalysis(item);
                      }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatchlist(item);
                        }}
                        className="text-neutral-400 hover:text-white transition-colors p-1"
                        title="Remove from Watchlist"
                      >
                        <svg
                          className="w-4 h-4 text-white"
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
                  ))}
                </div>
              )}
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}
