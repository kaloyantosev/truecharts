"use client";

import React from "react";
import Link from "next/link";
import PureTraderChart from "@/components/PureTraderChart";

export default function TraderPanelPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex flex-col">
      {/* Sleek Minimal Header */}
      <header className="h-11 px-4 bg-[var(--surface)] border-b border-[var(--line)] flex items-center justify-between text-xs font-mono select-none">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--fg)] transition-colors bg-[var(--hover)] border border-[var(--line)] px-2.5 py-1 rounded text-[11px]"
          >
            <span>←</span>
            <span>Home</span>
          </Link>
          <div className="h-4 w-[1px] bg-[var(--line)]" />
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-wider text-[var(--fg)]">TRADER PANEL</span>
            <span className="bg-[var(--up)]/10 text-[var(--up)] border border-[var(--up)]/30 px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wide">
              PRO DUAL
            </span>
          </div>
          <div className="h-4 w-[1px] bg-[var(--line)]" />
          <Link
            href="/backtest"
            className="flex items-center gap-1.5 text-[var(--warn)] hover:text-[var(--fg)] transition-colors bg-[var(--warn)]/10 border border-[var(--warn)]/40 px-2.5 py-1 rounded text-[11px] font-bold"
          >
            <span>⏪</span>
            <span>Backtester</span>
          </Link>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
          <div className="flex items-center gap-1.5 bg-[var(--hover)] px-2.5 py-1 rounded border border-[var(--line)]">
            <span className="w-2 h-2 rounded-full bg-[var(--up)]" />
            <span className="text-[var(--fg)] font-bold">1-Min Live Sync</span>
          </div>
        </div>
      </header>

      {/* Main Container: Centered, Big but not too wide, stacked vertically */}
      <div className="flex-1 w-full max-w-[1420px] mx-auto px-3 py-2 flex flex-col gap-3">
        {/* Top Chart: SPY AMEX */}
        <div className="w-full flex-1 min-h-[480px]">
          <PureTraderChart
            ticker="SPY"
            exchangeName="AMEX"
            chartTitle="SPDR S&P 500 ETF TRUST"
            defaultTimeframe="15m"
          />
        </div>

        {/* Bottom Chart: QQQ NASDAQ */}
        <div className="w-full flex-1 min-h-[480px]">
          <PureTraderChart
            ticker="QQQ"
            exchangeName="NASDAQ"
            chartTitle="INVESCO QQQ TRUST"
            defaultTimeframe="15m"
          />
        </div>
      </div>
    </main>
  );
}
