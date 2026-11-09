"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface GlobalHeaderProps {
  ticker: string;
  setTicker: (t: string) => void;
  onSearchSubmit: (symbol: string) => void;
  onOpenCommandPalette: () => void;
  apiConnected: boolean;
}

export default function GlobalHeader({
  ticker,
  setTicker,
  onSearchSubmit,
  onOpenCommandPalette,
  apiConnected,
}: GlobalHeaderProps) {
  const [inputVal, setInputVal] = useState(ticker);
  const [vix, setVix] = useState<{ price: number; changePct: number; closes5: number[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/quotes?symbols=VIX")
        .then((r) => (r.ok ? r.json() : { quotes: [] }))
        .then(({ quotes }) => {
          if (!cancelled && quotes[0]) setVix(quotes[0]);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const vixPath = (() => {
    const c = vix?.closes5 ?? [];
    if (c.length < 2) return "";
    const lo = Math.min(...c), hi = Math.max(...c);
    return c.map((v, i) => `${i ? "L" : "M"}${(i / (c.length - 1)) * 50} ${18 - ((v - lo) / (hi - lo || 1)) * 16}`).join(" ");
  })();
  const vixUp = (vix?.changePct ?? 0) >= 0;
  const [clocks, setClocks] = useState({
    nyc: "",
    london: "",
    dublin: "",
    tokyo: "",
  });

  useEffect(() => {
    setInputVal(ticker);
  }, [ticker]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClocks({
        nyc: now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        london: now.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        dublin: now.toLocaleTimeString("en-IE", { timeZone: "Europe/Dublin", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        tokyo: now.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      onSearchSubmit(inputVal.trim().toUpperCase());
    }
  };

  return (
    <header className="border-b border-[var(--line)] bg-[var(--bg)]/95 sticky top-0 z-50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[var(--fg)]">
      {/* Left: Logo & Live Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-mono font-bold text-base tracking-tight text-[var(--fg)]">
          <span className="text-[var(--fg)] text-lg font-bold">TrueCharts</span>
          <span className="bg-[var(--up)]/10 text-[var(--up)] border border-[var(--up)]/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide">
            PRO
          </span>
        </div>
        <div className="flex items-center gap-1.5 border border-[var(--line)] bg-[var(--hover)] px-2 py-0.5 rounded-full text-[10px] font-mono">
          <span className={`w-2 h-2 rounded-full ${apiConnected ? "bg-[var(--up)]" : "bg-[var(--muted)]"}`} />
          <span className={`${apiConnected ? "text-[var(--up)]" : "text-[var(--muted)]"} font-semibold tracking-wider`}>{apiConnected ? "LIVE" : "CONNECTING"}</span>
        </div>
      </div>

      {/* Center: Command Palette / Search Bar */}
      <div className="flex-1 max-w-md mx-auto">
        <form onSubmit={handleFormSubmit} className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onFocus={onOpenCommandPalette}
            placeholder="Search symbol (e.g. SPY, AAPL, ES1!)..."
            className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-md pl-9 pr-16 py-1.5 text-xs font-mono text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all uppercase tracking-wider"
          />
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="absolute inset-y-1 right-1 px-2 bg-[var(--hover)] border border-[var(--line)] hover:bg-[var(--hover)] text-[10px] font-mono text-[var(--muted)] rounded flex items-center gap-1 transition-colors"
          >
            <span className="text-[var(--accent)]">⌘K</span>
          </button>
        </form>
      </div>

      {/* Right: Market Clocks & VIX Sparkline Strip */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        {/* World Clocks */}
        <div className="hidden xl:flex items-center gap-3 border-r border-[var(--line)] pr-4 text-[10px] font-mono text-[var(--muted)]">
          <div className="flex items-center gap-1">
            <span className="text-[var(--muted)] font-bold uppercase">NYC:</span>
            <span className="text-[var(--fg)] font-bold">{clocks.nyc || "--:--:--"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[var(--muted)] font-bold uppercase">LON:</span>
            <span className="text-[var(--fg)] font-bold">{clocks.london || "--:--:--"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[var(--muted)] font-bold uppercase">DUB:</span>
            <span className="text-[var(--fg)] font-bold">{clocks.dublin || "--:--:--"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[var(--muted)] font-bold uppercase">TYO:</span>
            <span className="text-[var(--fg)] font-bold">{clocks.tokyo || "--:--:--"}</span>
          </div>
        </div>

        {/* Mini VIX Strip with 5D Sparkline */}
        <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--line)] px-2.5 py-1 rounded">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold text-[var(--muted)]">VIX</span>
              <span className="text-xs font-mono font-bold text-[var(--fg)]">{vix ? vix.price.toFixed(2) : "—"}</span>
              {vix && (
                <span className={`text-[9px] font-mono font-semibold ${vixUp ? "text-[var(--down)]" : "text-[var(--up)]"}`}>
                  {vixUp ? "+" : ""}{vix.changePct.toFixed(2)}%
                </span>
              )}
            </div>
            <span className="text-[8px] font-mono text-[var(--muted)] uppercase">5D Volatility</span>
          </div>
          {/* 5-day Sparkline SVG */}
          <svg className={`w-12 h-5 ${vixUp ? "text-[var(--down)]" : "text-[var(--up)]"}`} viewBox="0 0 50 20" fill="none">
            <path
              d={vixPath}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Trader Panel & Backtester Navigation Buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/trader-panel"
            className="flex items-center gap-1.5 px-3 py-1 bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--accent)] text-[var(--fg)] rounded-md text-xs font-semibold transition-colors"
          >
            <span className="text-[var(--violet)]">📊</span>
            <span>Trader Panel</span>
          </Link>

          <Link
            href="/backtest"
            className="flex items-center gap-1.5 px-3 py-1 bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--accent)] text-[var(--fg)] rounded-md text-xs font-semibold transition-colors"
          >
            <span className="text-[var(--warn)]">⏪</span>
            <span>Backtester</span>
          </Link>
        </div>

        {/* API Connection Indicator */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
            apiConnected
              ? "text-[var(--up)] bg-[var(--up)]/10 border-[var(--up)]/30"
              : "text-[var(--warn)] bg-[var(--warn)]/10 border-[var(--warn)]/30"
          }`}>
            {apiConnected ? "API: ONLINE" : "API: OFFLINE"}
          </span>
        </div>
      </div>
    </header>
  );
}
