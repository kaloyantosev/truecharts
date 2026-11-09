"use client";

import React, { useState, useEffect } from "react";

interface TickerAsset {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
  lastTickDir?: "up" | "down" | null;
}

// Symbols only. Prices come from /api/quotes (Yahoo Finance, delayed) and refresh every minute.
const TICKER_SYMBOLS: { symbol: string; name: string }[] = [
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "Nasdaq 100" },
  { symbol: "IWM", name: "Russell 2000" },
  { symbol: "NVDA", name: "NVIDIA Corp" },
  { symbol: "AAPL", name: "Apple Inc" },
  { symbol: "MSFT", name: "Microsoft Corp" },
  { symbol: "DXY", name: "US Dollar Index" },
  { symbol: "VIX", name: "CBOE Volatility" },
  { symbol: "TNX", name: "10Y Treasury Yield" },
  { symbol: "GOLD", name: "Gold futures ($/oz)" },
  { symbol: "CL1!", name: "WTI Crude Oil" },
  { symbol: "BTC/USD", name: "Bitcoin" },
  { symbol: "EUR/USD", name: "Euro FX" },
];
const REFRESH_MS = 60_000;

export default function LiveMarketTickerBar({
  onSelectTicker,
}: {
  onSelectTicker: (symbol: string) => void;
}) {
  const [assets, setAssets] = useState<TickerAsset[]>(
    TICKER_SYMBOLS.map((s) => ({ ...s, price: null, changePct: null }))
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(TICKER_SYMBOLS.map((s) => s.symbol).join(","))}`);
        if (!res.ok) return;
        const { quotes } = await res.json();
        if (cancelled) return;
        const bySym = new Map<string, { price: number; changePct: number }>(quotes.map((q: any) => [q.symbol, q]));
        setAssets((prev) =>
          prev.map((item) => {
            const q = bySym.get(item.symbol);
            if (!q) return { ...item, lastTickDir: null };
            const dir = item.price == null || q.price === item.price ? null : q.price > item.price ? "up" : "down";
            return { ...item, price: q.price, changePct: q.changePct, lastTickDir: dir };
          })
        );
      } catch {
        // keep the last real values; never invent ticks
      }
    };
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg)]/95 border-t border-[var(--line)] px-3 py-1.5 flex items-center overflow-hidden font-mono">
      {/* Pinned Label */}
      <div className="shrink-0 flex items-center gap-2 pr-4 border-r border-[var(--line)] mr-3 z-10 bg-[var(--bg)]">
        <span className="w-2 h-2 rounded-full bg-[var(--up)]" />
        <span className="text-[10px] font-bold text-[var(--up)] tracking-wide uppercase">
          MARKETS · DELAYED
        </span>
      </div>

      {/* Ticker Scrolling Track */}
      <div className="flex-1 overflow-hidden relative">
        <div className="animate-marquee flex items-center gap-6 text-xs font-mono">
          {[...assets, ...assets].map((item, idx) => {
            const isPos = (item.changePct ?? 0) >= 0;
            const flashClass =
              item.lastTickDir === "up"
                ? "animate-tick-green"
                : item.lastTickDir === "down"
                ? "animate-tick-red"
                : "";

            return (
              <div
                key={`${item.symbol}-${idx}`}
                onClick={() => {
                  const cleanSym = item.symbol.split("/")[0].replace("1!", "");
                  onSelectTicker(cleanSym);
                }}
                className={`flex items-center gap-2 cursor-pointer hover:bg-[var(--hover)] px-2 py-0.5 rounded transition-all ${flashClass}`}
              >
                <span className="font-bold text-[var(--fg)] uppercase">{item.symbol}</span>
                <span className="text-[var(--fg)] font-semibold">
                  {item.price == null ? "—" : item.price < 10 ? item.price.toFixed(4) : item.price.toFixed(2)}
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    isPos ? "text-[var(--up)]" : "text-[var(--down)]"
                  }`}
                >
                  {item.changePct == null ? "" : `${isPos ? "+" : ""}${item.changePct.toFixed(2)}%`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
