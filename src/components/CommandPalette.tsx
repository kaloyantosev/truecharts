"use client";

import React, { useState, useEffect, useRef } from "react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
}

const PRESET_SYMBOLS = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", category: "Index ETF" },
  { symbol: "QQQ", name: "Invesco QQQ Trust (Nasdaq 100)", category: "Index ETF" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", category: "Index ETF" },
  { symbol: "NVDA", name: "NVIDIA Corporation", category: "Mega Cap Tech" },
  { symbol: "AAPL", name: "Apple Inc.", category: "Mega Cap Tech" },
  { symbol: "MSFT", name: "Microsoft Corporation", category: "Mega Cap Tech" },
  { symbol: "AMZN", name: "Amazon.com Inc.", category: "Mega Cap Tech" },
  { symbol: "META", name: "Meta Platforms Inc.", category: "Mega Cap Tech" },
  { symbol: "TSLA", name: "Tesla Inc.", category: "Automotive / EV" },
  { symbol: "SMCI", name: "Super Micro Computer Inc.", category: "AI Hardware" },
  { symbol: "ES1!", name: "E-mini S&P 500 Futures", category: "Futures" },
  { symbol: "NQ1!", name: "E-mini Nasdaq 100 Futures", category: "Futures" },
  { symbol: "XLK", name: "Technology Select Sector SPDR", category: "GICS Sector" },
  { symbol: "XLF", name: "Financial Select Sector SPDR", category: "GICS Sector" },
  { symbol: "XLE", name: "Energy Select Sector SPDR", category: "GICS Sector" },
];

export default function CommandPalette({ isOpen, onClose, onSelectSymbol }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [changes, setChanges] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch(`/api/quotes?symbols=${encodeURIComponent(PRESET_SYMBOLS.map((p) => p.symbol).join(","))}`)
      .then((r) => (r.ok ? r.json() : { quotes: [] }))
      .then(({ quotes }) => {
        if (!cancelled) setChanges(Object.fromEntries(quotes.map((q: { symbol: string; changePct: number }) => [q.symbol, q.changePct])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery("");
          setSelectedIndex(0);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = PRESET_SYMBOLS.filter(
    (item) =>
      item.symbol.toLowerCase().includes(query.toLowerCase()) ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDownModal = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelectSymbol(filtered[selectedIndex].symbol);
        onClose();
      } else if (query.trim()) {
        onSelectSymbol(query.trim().toUpperCase());
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center pt-20 px-4">
      <div
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg w-full max-w-xl overflow-hidden flex flex-col"
        onKeyDown={handleKeyDownModal}
      >
        {/* Search Input Bar */}
        <div className="p-3 border-b border-[var(--line)] flex items-center gap-3">
          <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a ticker symbol or asset name..."
            className="w-full bg-transparent text-sm font-mono text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none uppercase"
          />
          <button
            onClick={onClose}
            className="px-2 py-0.5 text-[10px] font-mono text-[var(--muted)] bg-[var(--hover)] border border-[var(--line)] rounded hover:text-[var(--fg)]"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-[var(--line)]">
          {filtered.length === 0 ? (
            <div
              onClick={() => {
                if (query.trim()) {
                  onSelectSymbol(query.trim().toUpperCase());
                  onClose();
                }
              }}
              className="p-4 text-center cursor-pointer hover:bg-[var(--hover)] rounded text-xs font-mono text-[var(--muted)]"
            >
              Analyze custom symbol <span className="text-[var(--up)] font-bold">"{query.toUpperCase()}"</span> (Press Enter)
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const chg = changes[item.symbol];
              const isPositive = (chg ?? 0) >= 0;
              return (
                <div
                  key={item.symbol}
                  onClick={() => {
                    onSelectSymbol(item.symbol);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-2.5 rounded cursor-pointer transition-all ${
                    isSelected ? "bg-[var(--hover)] border border-[var(--accent)]/40" : "hover:bg-[var(--hover)] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-[var(--up)] tracking-wider w-16">
                      {item.symbol}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-[var(--fg)]">{item.name}</span>
                      <span className="text-[10px] font-mono text-[var(--muted)]">{item.category}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-mono font-bold ${isPositive ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                    {chg == null ? "—" : `${isPositive ? "+" : ""}${chg.toFixed(2)}%`}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-2.5 bg-[var(--surface)] border-t border-[var(--line)] flex items-center justify-between text-[10px] font-mono text-[var(--muted)]">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span className="text-[var(--accent)]">TrueCharts Command Engine v2.4</span>
        </div>
      </div>
    </div>
  );
}
