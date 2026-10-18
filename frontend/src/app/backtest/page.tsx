"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import BacktestChart from "@/components/BacktestChart";

export default function BacktestPage() {
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [viewMode, setViewMode] = useState<"spy" | "qqq" | "dual">("spy");
  const [loadingDates, setLoadingDates] = useState<boolean>(true);

  // Unbiased / Blind Backtest State
  const [isBlindMode, setIsBlindMode] = useState<boolean>(false);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [sessionCount, setSessionCount] = useState<number>(1);

  // Load available trading dates from the backtest API on mount
  useEffect(() => {
    async function loadDates() {
      try {
        const res = await fetch("/api/backtest?ticker=SPY&timeframe=5m");
        if (res.ok) {
          const data = await res.json();
          if (data.availableDates && data.availableDates.length > 0) {
            setAvailableDates(data.availableDates);
            setSelectedDate(data.availableDates[data.availableDates.length - 1]);
          }
        }
      } catch (err) {
        console.error("Failed to load backtest dates:", err);
      } finally {
        setLoadingDates(false);
      }
    }
    loadDates();
  }, []);

  const currentIndex = availableDates.indexOf(selectedDate);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < availableDates.length - 1 && currentIndex !== -1;

  const goToPrev = () => {
    if (hasPrev) {
      setSelectedDate(availableDates[currentIndex - 1]);
    }
  };

  const goToNext = () => {
    if (hasNext) {
      setSelectedDate(availableDates[currentIndex + 1]);
    }
  };

  // Pick a random day and mask date for a 100% unbiased backtest
  const handleRandomDay = () => {
    if (availableDates.length === 0) return;
    const randomIndex = Math.floor(Math.random() * availableDates.length);
    setSelectedDate(availableDates[randomIndex]);
    setIsBlindMode(true);
    setRevealed(false);
    setSessionCount((prev) => prev + 1);
  };

  const effectiveBlind = isBlindMode && !revealed;

  return (
    <main className="min-h-screen bg-[#05060a] text-neutral-100 flex flex-col">
      {/* Sleek Minimal Header */}
      <header className="h-12 px-4 bg-[#080b14] border-b border-[#1e293b] flex items-center justify-between text-xs font-mono select-none">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors bg-[#0f172a] border border-[#1e293b] px-2.5 py-1 rounded text-[11px]"
          >
            <span>←</span>
            <span>Home</span>
          </Link>
          <Link
            href="/trader-panel"
            className="flex items-center gap-1.5 text-purple-300 hover:text-white transition-colors bg-purple-900/30 border border-purple-500/40 px-2.5 py-1 rounded text-[11px] font-bold"
          >
            <span>📊</span>
            <span>Trader Panel</span>
          </Link>

          <div className="h-4 w-[1px] bg-[#1e293b]" />

          <div className="flex items-center gap-2">
            <span className="font-black tracking-wider text-white">BACKTESTER</span>
            <span className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/40 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-widest">
              {effectiveBlind ? "UNBIASED BLIND MODE" : "HISTORICAL REPLAY"}
            </span>
          </div>
        </div>

        {/* Center Controls: Symbol Selector & Session / Random Controls */}
        <div className="flex items-center gap-3">
          {/* Symbol Selector: SPY / QQQ / Dual */}
          <div className="flex items-center gap-1 bg-[#0b0f19] p-1 rounded border border-[#1e293b]">
            <span className="text-[10px] text-neutral-400 font-semibold px-1.5">SYMBOL:</span>
            <button
              onClick={() => setViewMode("spy")}
              className={`px-3 py-0.5 rounded text-[11px] font-bold transition-all ${
                viewMode === "spy"
                  ? "bg-[#38bdf8] text-black font-black shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              SPY
            </button>
            <button
              onClick={() => setViewMode("qqq")}
              className={`px-3 py-0.5 rounded text-[11px] font-bold transition-all ${
                viewMode === "qqq"
                  ? "bg-[#38bdf8] text-black font-black shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              QQQ
            </button>
            <button
              onClick={() => setViewMode("dual")}
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                viewMode === "dual"
                  ? "bg-[#38bdf8] text-black font-black"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Dual (SPY+QQQ)
            </button>
          </div>

          {/* Random Day Button for Unbiased Backtesting */}
          <button
            onClick={handleRandomDay}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded text-[11px] font-bold transition-all shadow-[0_0_12px_rgba(168,85,247,0.35)] active:scale-95"
            title="Pick a random session without showing the date for a 100% unbiased backtest"
          >
            <span>🎲</span>
            <span>Random Day</span>
          </button>

          {/* Date Controls (Masked in Blind Mode) */}
          <div className="flex items-center gap-1 bg-[#0b0f19] px-2 py-1 rounded border border-[#1e293b]">
            {effectiveBlind ? (
              <div className="flex items-center gap-2 px-1">
                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                  <span>🔒</span>
                  <span>Session #{sessionCount} (Hidden Date)</span>
                </span>
                <button
                  onClick={() => setRevealed(true)}
                  className="px-2 py-0.5 rounded bg-[#1e293b] hover:bg-[#334155] text-neutral-200 text-[10px] font-bold transition-colors border border-[#475569]"
                  title="Reveal the actual calendar date of this session"
                >
                  👁️ Reveal Date
                </button>
              </div>
            ) : (
              <>
                <span className="text-[10px] text-neutral-400 font-semibold mr-1">DAY:</span>
                <button
                  onClick={goToPrev}
                  disabled={!hasPrev || loadingDates}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                    hasPrev
                      ? "bg-[#0f172a] hover:bg-[#1e293b] text-neutral-200 border-[#334155]"
                      : "bg-black/30 text-neutral-600 border-[#1e293b] cursor-not-allowed"
                  }`}
                >
                  ← Prev
                </button>

                <select
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setRevealed(true);
                  }}
                  disabled={loadingDates}
                  className="bg-[#0f172a] text-[#facc15] font-mono text-[11px] font-black px-2.5 py-0.5 rounded border border-[#334155] focus:outline-none focus:border-[#facc15]"
                >
                  {availableDates.map((d) => (
                    <option key={d} value={d} className="bg-[#080b14] text-white">
                      {d}
                    </option>
                  ))}
                </select>

                <button
                  onClick={goToNext}
                  disabled={!hasNext || loadingDates}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                    hasNext
                      ? "bg-[#0f172a] hover:bg-[#1e293b] text-neutral-200 border-[#334155]"
                      : "bg-black/30 text-neutral-600 border-[#1e293b] cursor-not-allowed"
                  }`}
                >
                  Next →
                </button>

                {isBlindMode && revealed && (
                  <button
                    onClick={() => setRevealed(false)}
                    className="ml-1 px-1.5 py-0.5 rounded bg-[#1e293b] hover:bg-[#334155] text-neutral-400 hover:text-white text-[10px] font-bold border border-[#475569]"
                    title="Hide date again"
                  >
                    🔒 Hide
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Informational Badges */}
        <div className="flex items-center gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 bg-[#0f172a] px-2.5 py-1 rounded border border-[#1e293b]">
            <span className="w-2 h-2 rounded-full bg-[#facc15]" />
            <span className="text-neutral-300 font-bold text-[10px]">5m · 09:30 – 16:00 ET (RTH)</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-[1420px] mx-auto px-3 py-2 flex flex-col gap-3">
        {/* SPY Chart */}
        {(viewMode === "spy" || viewMode === "dual") && (
          <div className="w-full">
            {selectedDate && (
              <BacktestChart
                ticker="SPY"
                exchangeName="AMEX"
                chartTitle="SPDR S&P 500 ETF TRUST"
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                availableDates={availableDates}
                defaultTimeframe="5m"
                heightClass={viewMode === "spy" ? "h-[640px]" : "h-[520px]"}
                isBlindMode={effectiveBlind}
              />
            )}
          </div>
        )}

        {/* QQQ Chart */}
        {(viewMode === "qqq" || viewMode === "dual") && (
          <div className="w-full">
            {selectedDate && (
              <BacktestChart
                ticker="QQQ"
                exchangeName="NASDAQ"
                chartTitle="INVESCO QQQ TRUST"
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                availableDates={availableDates}
                defaultTimeframe="5m"
                heightClass={viewMode === "qqq" ? "h-[640px]" : "h-[520px]"}
                isBlindMode={effectiveBlind}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
