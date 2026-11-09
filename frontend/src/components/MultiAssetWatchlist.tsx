"use client";

import React, { useEffect, useState } from "react";

import { INSTITUTIONAL_BY_SYMBOL } from "@/data/realInstitutionalData";

interface WatchlistItem {
  ticker: string;
  name: string;
}

interface Quote {
  symbol: string;
  price: number;
  changePct: number;
  volume: number | null;
  avgVolume20: number | null;
}

/** Options context for the symbol currently analyzed on the main chart (from /api/analyze). */
export interface ActiveAnalytics {
  ticker: string;
  put_call_ratio?: number;
  max_pain?: number;
  gamma_flip?: number;
}

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { ticker: "SPY", name: "S&P 500 ETF" },
  { ticker: "QQQ", name: "Invesco QQQ Trust" },
  { ticker: "NVDA", name: "NVIDIA Corp" },
  { ticker: "AAPL", name: "Apple Inc." },
  { ticker: "MSFT", name: "Microsoft Corp" },
  { ticker: "META", name: "Meta Platforms" },
  { ticker: "TSLA", name: "Tesla Inc." },
  { ticker: "IWM", name: "Russell 2000 ETF" },
];

const TREND_LABEL: Record<string, "Accumulating" | "Distributing" | "Neutral"> = {
  Accumulation: "Accumulating",
  Distribution: "Distributing",
  Neutral: "Neutral",
};

export default function MultiAssetWatchlist({
  activeTicker,
  onSelectTicker,
  analytics,
}: {
  activeTicker: string;
  onSelectTicker: (t: string) => void;
  analytics?: ActiveAnalytics | null;
}) {
  const [filterText, setFilterText] = useState("");
  const [newSymbolInput, setNewSymbolInput] = useState("");
  const [items, setItems] = useState<WatchlistItem[]>(DEFAULT_WATCHLIST);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  const symbolsKey = items.map((i) => i.ticker).join(",");
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbolsKey)}`);
        if (!res.ok) return;
        const { quotes: qs } = await res.json();
        if (!cancelled) setQuotes(Object.fromEntries(qs.map((q: Quote) => [q.symbol, q])));
      } catch {
        // leave the last real values in place
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbolsKey]);

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = newSymbolInput.trim().toUpperCase();
    if (!sym) return;
    if (items.some((i) => i.ticker === sym)) return;
    setItems((prev) => [{ ticker: sym, name: sym }, ...prev]);
    setNewSymbolInput("");
    onSelectTicker(sym);
  };

  const filteredItems = items.filter(
    (item) =>
      item.ticker.toLowerCase().includes(filterText.toLowerCase()) ||
      item.name.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--accent)] font-mono font-bold text-sm">MODULE 5</span>
            <h2 className="text-sm font-bold text-[var(--fg)] uppercase tracking-wider">
              Multi-Asset Watchlist with Order Flow Context
            </h2>
          </div>
          <p className="text-[11px] font-mono text-[var(--muted)] mt-0.5">
            Delayed quotes · Volume vs 20-day average · Options context for the analyzed symbol · 13F trend
          </p>
        </div>

        {/* Search & Add Ticker Controls */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter watchlist..."
            className="bg-[var(--surface)] border border-[var(--line)] text-xs font-mono px-3 py-1.5 rounded text-[var(--fg)] focus:outline-none focus:border-[var(--accent)] w-36 uppercase"
          />
          <form onSubmit={handleAddSymbol} className="flex items-center gap-1">
            <input
              type="text"
              value={newSymbolInput}
              onChange={(e) => setNewSymbolInput(e.target.value)}
              placeholder="+ Add Symbol"
              className="bg-[var(--surface)] border border-[var(--line)] text-xs font-mono px-2.5 py-1.5 rounded text-[var(--fg)] focus:outline-none focus:border-[var(--up)] w-28 uppercase"
            />
            <button
              type="submit"
              className="bg-[var(--up)]/10 border border-[var(--up)]/30 hover:bg-[var(--up)]/20 text-[var(--up)] text-xs font-mono px-2.5 py-1.5 rounded font-bold transition-colors"
            >
              Add
            </button>
          </form>
        </div>
      </div>

      {/* Watchlist Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-mono">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)] bg-[var(--surface)]">
              <th className="py-2.5 px-3">Ticker</th>
              <th className="py-2.5 px-3 text-right">Price</th>
              <th className="py-2.5 px-3 text-right">1D Change</th>
              <th className="py-2.5 px-3 text-right">Vol vs 20D Avg</th>
              <th className="py-2.5 px-3 text-right">Put/Call (OI)</th>
              <th className="py-2.5 px-3">Max pain · Gamma flip</th>
              <th className="py-2.5 px-3 text-right">13F Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)] text-xs">
            {filteredItems.map((item) => {
              const isActive = activeTicker.toUpperCase() === item.ticker.toUpperCase();
              const q = quotes[item.ticker];
              const isPos = (q?.changePct ?? 0) >= 0;
              const volRatio = q?.volume && q?.avgVolume20 ? q.volume / q.avgVolume20 : null;
              const opt = analytics && analytics.ticker?.toUpperCase() === item.ticker ? analytics : null;
              const inst = INSTITUTIONAL_BY_SYMBOL[item.ticker];
              const trend13F = inst ? TREND_LABEL[inst.trend] : null;

              return (
                <tr
                  key={item.ticker}
                  onClick={() => onSelectTicker(item.ticker)}
                  className={`cursor-pointer transition-colors ${
                    isActive
                      ? "bg-[var(--hover)] border-l-2 border-l-[var(--accent)]"
                      : "hover:bg-[var(--hover)]"
                  }`}
                >
                  {/* Ticker & Name */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isActive ? "bg-[var(--accent)]" : "bg-[var(--muted)]"
                        }`}
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-[var(--fg)] text-sm">{item.ticker}</span>
                        <span className="text-[10px] text-[var(--muted)] truncate max-w-[120px]">
                          {item.name}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-3 px-3 text-right font-bold text-[var(--fg)] text-sm">
                    {q ? `$${q.price.toFixed(2)}` : "—"}
                  </td>

                  {/* 1D Change */}
                  <td className="py-3 px-3 text-right font-bold">
                    {q ? (
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          isPos
                            ? "text-[var(--up)] bg-[var(--up)]/10 border border-[var(--up)]/30"
                            : "text-[var(--down)] bg-[var(--down)]/10 border border-[var(--down)]/30"
                        }`}
                      >
                        {isPos ? "+" : ""}
                        {q.changePct.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>

                  {/* Vol vs 20D Avg */}
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-bold text-[var(--fg)]">
                        {volRatio == null ? "—" : `${(volRatio * 100).toFixed(0)}%`}
                      </span>
                      {volRatio != null && volRatio >= 1.5 && (
                        <span className="text-[9px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 px-1 py-0.5 rounded uppercase tracking-wider" title="Volume Surge Active">
                          SURGE
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Net Delta Flow */}
                  <td className="py-3 px-3 text-right">
                    {opt?.put_call_ratio != null ? (
                      <span className={`font-bold ${opt.put_call_ratio < 1 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                        {opt.put_call_ratio.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]" title="Analyze this symbol to load its options data">—</span>
                    )}
                  </td>

                  {/* OI Nearest Strike */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                      <span className="text-[var(--fg)] text-xs font-semibold">
                        {opt?.max_pain
                          ? `$${opt.max_pain.toFixed(2)}${opt.gamma_flip ? ` · $${opt.gamma_flip.toFixed(2)}` : ""}`
                          : "—"}
                      </span>
                    </div>
                  </td>

                  {/* 13F Trend */}
                  <td className="py-3 px-3 text-right">
                    {trend13F ? (
                    <span
                      title={inst ? `Top-10 holders ${inst.flowPct > 0 ? "+" : ""}${inst.flowPct}% QoQ` : undefined}
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        trend13F === "Accumulating"
                          ? "bg-[var(--up)]/10 text-[var(--up)] border-[var(--up)]/30"
                          : trend13F === "Distributing"
                          ? "bg-[var(--down)]/10 text-[var(--down)] border-[var(--down)]/30"
                          : "bg-[var(--hover)] text-[var(--fg)] border-[var(--line)]"
                      }`}
                    >
                      {trend13F}
                    </span>
                    ) : (
                      <span className="text-[var(--muted)]" title="No 13F holder data (ETF or not covered)">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
