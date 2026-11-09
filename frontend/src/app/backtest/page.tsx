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
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex flex-col">
      {/* Sleek Minimal Header */}
      <header className="h-12 px-4 bg-[var(--surface)] border-b border-[var(--line)] flex items-center justify-between text-xs font-mono select-none">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--fg)] transition-colors bg-[var(--hover)] border border-[var(--line)] px-2.5 py-1 rounded text-[11px]"
          >
            <span>←</span>
            <span>Home</span>
          </Link>
          <Link
            href="/trader-panel"
            className="flex items-center gap-1.5 text-[var(--violet)] hover:text-[var(--fg)] transition-colors bg-purple-900/30 border border-[var(--violet)]/40 px-2.5 py-1 rounded text-[11px] font-bold"
          >
            <span>📊</span>
            <span>Trader Panel</span>
          </Link>

          <div className="h-4 w-[1px] bg-[var(--line)]" />

          <div className="flex items-center gap-2">
            <span className="font-bold tracking-wider text-[var(--fg)]">BACKTESTER</span>
            <span className="bg-[var(--up)]/15 text-[var(--up)] border border-[var(--up)]/40 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wide">
              {effectiveBlind ? "UNBIASED BLIND MODE" : "HISTORICAL REPLAY"}
            </span>
          </div>
        </div>

        {/* Center Controls: Symbol Selector & Session / Random Controls */}
        <div className="flex items-center gap-3">
          {/* Symbol Selector: SPY / QQQ / Dual */}
          <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded border border-[var(--line)]">
            <span className="text-[10px] text-[var(--muted)] font-semibold px-1.5">SYMBOL:</span>
            <button
              onClick={() => setViewMode("spy")}
              className={`px-3 py-0.5 rounded text-[11px] font-bold transition-all ${
                viewMode === "spy"
                  ? "bg-[var(--accent)] text-white font-bold"
                  : "text-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              SPY
            </button>
            <button
              onClick={() => setViewMode("qqq")}
              className={`px-3 py-0.5 rounded text-[11px] font-bold transition-all ${
                viewMode === "qqq"
                  ? "bg-[var(--accent)] text-white font-bold"
                  : "text-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              QQQ
            </button>
            <button
              onClick={() => setViewMode("dual")}
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                viewMode === "dual"
                  ? "bg-[var(--accent)] text-white font-bold"
                  : "text-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              Dual (SPY+QQQ)
            </button>
          </div>

          {/* Random Day Button for Unbiased Backtesting */}
          <button
            onClick={handleRandomDay}
            className="flex items-center gap-1.5 px-3 py-1 bg-[var(--accent)] hover:opacity-90 text-white rounded-md text-[11px] font-bold transition-all active:scale-95"
            title="Pick a random session without showing the date for a 100% unbiased backtest"
          >
            <span>🎲</span>
            <span>Random Day</span>
          </button>

          {/* Date Controls (Masked in Blind Mode) */}
          <div className="flex items-center gap-1 bg-[var(--surface)] px-2 py-1 rounded border border-[var(--line)]">
            {effectiveBlind ? (
              <div className="flex items-center gap-2 px-1">
                <span className="text-[11px] font-bold text-[var(--warn)] flex items-center gap-1">
                  <span>🔒</span>
                  <span>Session #{sessionCount} (Hidden Date)</span>
                </span>
                <button
                  onClick={() => setRevealed(true)}
                  className="px-2 py-0.5 rounded bg-[var(--line)] hover:bg-[var(--line)] text-[var(--fg)] text-[10px] font-bold transition-colors border border-[var(--line)]"
                  title="Reveal the actual calendar date of this session"
                >
                  👁️ Reveal Date
                </button>
              </div>
            ) : (
              <>
                <span className="text-[10px] text-[var(--muted)] font-semibold mr-1">DAY:</span>
                <button
                  onClick={goToPrev}
                  disabled={!hasPrev || loadingDates}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                    hasPrev
                      ? "bg-[var(--hover)] hover:bg-[var(--line)] text-[var(--fg)] border-[var(--line)]"
                      : "bg-black/30 text-[var(--muted)] border-[var(--line)] cursor-not-allowed"
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
                  className="bg-[var(--hover)] text-[var(--warn)] font-mono text-[11px] font-bold px-2.5 py-0.5 rounded border border-[var(--line)] focus:outline-none focus:border-[var(--warn)]"
                >
                  {availableDates.map((d) => (
                    <option key={d} value={d} className="bg-[var(--surface)] text-[var(--fg)]">
                      {d}
                    </option>
                  ))}
                </select>

                <button
                  onClick={goToNext}
                  disabled={!hasNext || loadingDates}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                    hasNext
                      ? "bg-[var(--hover)] hover:bg-[var(--line)] text-[var(--fg)] border-[var(--line)]"
                      : "bg-black/30 text-[var(--muted)] border-[var(--line)] cursor-not-allowed"
                  }`}
                >
                  Next →
                </button>

                {isBlindMode && revealed && (
                  <button
                    onClick={() => setRevealed(false)}
                    className="ml-1 px-1.5 py-0.5 rounded bg-[var(--line)] hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--fg)] text-[10px] font-bold border border-[var(--line)]"
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
          <div className="flex items-center gap-1.5 bg-[var(--hover)] px-2.5 py-1 rounded border border-[var(--line)]">
            <span className="w-2 h-2 rounded-full bg-[var(--warn)]" />
            <span className="text-[var(--fg)] font-bold text-[10px]">5m · 09:30 – 16:00 ET (RTH)</span>
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
                onRandomDay={handleRandomDay}
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
                onRandomDay={handleRandomDay}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
