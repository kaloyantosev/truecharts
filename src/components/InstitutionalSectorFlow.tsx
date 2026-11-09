"use client";

import React, { useState } from "react";
import {
  REAL_TOP_20_CONVICTION as TOP_20_CONVICTION,
  REAL_GICS_SECTORS as GICS_SECTORS,
  REAL_BUBBLE_STOCKS as BUBBLE_STOCKS,
  INSTITUTIONAL_META,
} from "@/data/realInstitutionalData";

export default function InstitutionalSectorFlow({ onSelectTicker }: { onSelectTicker: (t: string) => void }) {
  const [expandedSector, setExpandedSector] = useState<string | null>("XLK");
  const [hoveredBubble, setHoveredBubble] = useState<any | null>(null);
  const latestQuarter = INSTITUTIONAL_META.latestFilingQuarter ?? "—";

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-5 flex flex-col gap-6">
      {/* Module Title */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--accent)] font-mono font-bold text-sm">MODULE 3</span>
            <h2 className="text-sm font-bold text-[var(--fg)] uppercase tracking-wider">
              13F Institutional Flow & Sector Rotation
            </h2>
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">
            Quarter-over-quarter 13F changes of each stock&apos;s 10 largest holders · updated automatically · as of {INSTITUTIONAL_META.asOf}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="bg-[var(--hover)] border border-[var(--line)] text-[var(--fg)] px-2.5 py-1 rounded font-mono font-medium">
            Latest Filing Quarter: {latestQuarter}
          </span>
          <span className="bg-[var(--up)]/10 border border-[var(--up)]/30 text-[var(--up)] px-2.5 py-1 rounded font-bold tracking-wider" title={INSTITUTIONAL_META.source}>
            SEC 13F · auto-updated
          </span>
        </div>
      </div>

      {/* 11 GICS SECTORS HEATMAP */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[var(--fg)] uppercase tracking-wide flex items-center gap-2">
            <span>11 GICS Sectors Heatmap (QoQ top-holder net $ flow)</span>
          </h3>
          <span className="text-[10px] font-mono text-[var(--muted)]">
            Click any sector tile to inspect top buying & selling stocks
          </span>
        </div>

        {/* Heatmap Tiles Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
          {GICS_SECTORS.map((sec) => {
            const isBullish = sec.netFlow >= 0;
            const isSelected = expandedSector === sec.code;
            const intensity = Math.min(100, Math.abs(sec.netFlow / sec.maxFlow) * 100);

            let bgStyle = isBullish
              ? `rgba(0, 255, 136, ${0.08 + (intensity / 100) * 0.25})`
              : `rgba(255, 51, 85, ${0.08 + (intensity / 100) * 0.25})`;

            let borderStyle = isSelected
              ? "border-[var(--accent)]"
              : isBullish
              ? "border-[var(--up)]/40 hover:border-[var(--up)]"
              : "border-[var(--down)]/40 hover:border-[var(--down)]";

            return (
              <div
                key={sec.code}
                onClick={() => {
                  setExpandedSector(expandedSector === sec.code ? null : sec.code);
                }}
                style={{ backgroundColor: bgStyle }}
                className={`border rounded-md p-3 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[90px] relative overflow-hidden group ${borderStyle}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-mono font-bold text-[var(--fg)] uppercase truncate">
                    {sec.name}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-[var(--fg)] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--line)]">
                    {sec.code}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-[9px] font-mono text-[var(--muted)] uppercase">QoQ 13F Flow</span>
                  <span
                    className={`text-sm font-mono font-bold ${
                      isBullish ? "text-[var(--up)]" : "text-[var(--down)]"
                    }`}
                  >
                    {isBullish ? "+" : ""}
                    {sec.netFlow.toFixed(1)}B
                  </span>
                </div>
                {/* Progress bar inside tile */}
                <div className="w-full h-1 bg-[var(--hover)] rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full ${isBullish ? "bg-[var(--up)]" : "bg-[var(--down)]"}`}
                    style={{ width: `${intensity}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Expanded Sector Details Panel */}
        {expandedSector && (
          <div className="mt-2 bg-[var(--surface)] border border-[var(--accent)]/30 rounded-lg p-4">
            {(() => {
              const sec = GICS_SECTORS.find((s) => s.code === expandedSector);
              if (!sec) return null;
              return (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[var(--fg)] font-mono">{sec.name} ({sec.code})</span>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          sec.netFlow >= 0 ? "bg-[var(--up)]/10 text-[var(--up)] border border-[var(--up)]/30" : "bg-[var(--down)]/10 text-[var(--down)] border border-[var(--down)]/30"
                        }`}
                      >
                        Net 13F Flow: {sec.netFlow >= 0 ? "+" : ""}{sec.netFlow.toFixed(1)}B
                      </span>
                    </div>
                    <button
                      onClick={() => onSelectTicker(sec.code)}
                      className="text-[10px] font-mono text-[var(--accent)] hover:underline"
                    >
                      Load {sec.code} ETF Benchmark on Chart →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Top Net Buying Stocks */}
                    <div className="bg-[var(--surface)] border border-[var(--line)] rounded p-3 flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-[var(--up)] uppercase tracking-wider">
                        Top Net 13F Buying Positions
                      </span>
                      <div className="flex flex-col divide-y divide-[var(--line)]">
                        {sec.topBuyStocks.map((stk) => (
                          <div
                            key={stk.ticker}
                            onClick={() => onSelectTicker(stk.ticker)}
                            className="py-1.5 flex items-center justify-between text-xs font-mono hover:bg-[var(--hover)] px-1 rounded cursor-pointer"
                          >
                            <span className="font-bold text-[var(--fg)]">{stk.ticker}</span>
                            <span className="text-[var(--muted)]">{stk.shares}</span>
                            <span className="text-[var(--fg)]">{stk.value}</span>
                            <span className="text-[var(--up)] font-bold">{stk.flow}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Net Selling Stocks */}
                    <div className="bg-[var(--surface)] border border-[var(--line)] rounded p-3 flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-[var(--down)] uppercase tracking-wider">
                        Top Net 13F Distribution Positions
                      </span>
                      <div className="flex flex-col divide-y divide-[var(--line)]">
                        {sec.topSellStocks.length === 0 && <span className="py-1.5 text-xs text-[var(--muted)]">No net selling among this sector&apos;s leaders.</span>}
                        {sec.topSellStocks.map((stk) => (
                          <div
                            key={stk.ticker}
                            onClick={() => onSelectTicker(stk.ticker)}
                            className="py-1.5 flex items-center justify-between text-xs font-mono hover:bg-[var(--hover)] px-1 rounded cursor-pointer"
                          >
                            <span className="font-bold text-[var(--fg)]">{stk.ticker}</span>
                            <span className="text-[var(--muted)]">{stk.shares}</span>
                            <span className="text-[var(--fg)]">{stk.value}</span>
                            <span className="text-[var(--down)] font-bold">{stk.flow}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* BUBBLE CHART & HF CONVICTION TABLE GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-2">
        {/* Left 5 cols: Institutional Position Bubble Chart */}
        <div className="xl:col-span-5 bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider font-mono">
              Institutional Positioning Scatter (Bubble Chart)
            </h3>
            <span className="text-[9px] font-mono text-[var(--muted)]">Bubble size = institutional $ held</span>
          </div>
          <p className="text-[10px] font-mono text-[var(--muted)]">
            X axis: QoQ top-holder share change (%) · Y axis: 3-month return (%)
          </p>

          {/* Interactive SVG Bubble Chart */}
          <div className="w-full h-64 bg-[var(--bg)] border border-[var(--line)] rounded relative overflow-hidden flex items-center justify-center">
            {/* Axis grid lines */}
            <div className="absolute inset-0 border-b border-r border-[var(--line)] left-1/2 top-1/2 pointer-events-none" />
            <span className="absolute left-2 top-2 text-[9px] font-mono text-[var(--muted)]">+3M Perf</span>
            <span className="absolute right-2 bottom-2 text-[9px] font-mono text-[var(--muted)]">+QoQ 13F Accumulation →</span>

            <svg className="w-full h-full p-6">
              {BUBBLE_STOCKS.map((stk) => {
                // Map QoQ (-15 to +20) to SVG X (10% to 90%)
                const cx = Math.max(6, Math.min(94, 50 + (stk.qoqChg / 10) * 40));
                // Map Perf3M (-30 to +40) to SVG Y (90% to 10%)
                const cy = Math.max(6, Math.min(94, 50 - (stk.perf3M / 45) * 40));
                // Radius based on 13F size $B (min 6px, max 24px)
                const baseR = Math.max(6, Math.min(24, Math.sqrt(stk.sizeB) * 0.4));
                const isHovered = hoveredBubble?.ticker === stk.ticker;

                return (
                  <g
                    key={stk.ticker}
                    className="cursor-pointer"
                    onClick={() => onSelectTicker(stk.ticker)}
                    onMouseEnter={() => setHoveredBubble(stk)}
                    onMouseLeave={() => setHoveredBubble(null)}
                  >
                    <circle
                      cx={`${cx}%`}
                      cy={`${cy}%`}
                      r={isHovered ? baseR + 3.5 : baseR}
                      fill={stk.color}
                      fillOpacity={isHovered ? 0.85 : 0.4}
                      stroke={stk.color}
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      style={{ transition: "r 0.15s ease-out, fill-opacity 0.15s ease-out, stroke-width 0.15s ease-out" }}
                    />
                    <text
                      x={`${cx}%`}
                      y={`${cy}%`}
                      dy="4"
                      textAnchor="middle"
                      style={{ fontSize: "9px", fontFamily: "monospace", fontWeight: "bold", fill: "white", pointerEvents: "none", userSelect: "none" }}
                    >
                      {stk.ticker}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredBubble && (
              <div className="absolute top-2 right-2 bg-[var(--surface)] border border-[var(--accent)]/50 px-3 py-2 rounded text-[10px] font-mono z-10 pointer-events-none">
                <div className="font-bold text-[var(--accent)]">{hoveredBubble.ticker}</div>
                <div className="text-[var(--fg)]">13F Holdings: ${hoveredBubble.sizeB}B</div>
                <div className="text-[var(--fg)]">QoQ 13F Change: {hoveredBubble.qoqChg}%</div>
                <div className="text-[var(--fg)]">3M Stock Return: {hoveredBubble.perf3M}%</div>
              </div>
            )}
          </div>
        </div>

        {/* Right 7 cols: Hedge Fund Conviction Table (TOP 20 - Responds to "дай 20") */}
        <div className="xl:col-span-7 bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
            <div>
              <h3 className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider font-sans flex items-center gap-2">
                Institutional Conviction Table (Top 20 Positions)
              </h3>
              <p className="text-[10px] font-mono text-[var(--muted)]">
                Ranked by number of 13F institutional holders · Δ = QoQ share change of the 10 largest holders
              </p>
            </div>
            <span className="text-[9px] font-mono text-[var(--up)] bg-[var(--up)]/10 border border-[var(--up)]/30 px-2 py-0.5 rounded font-bold">
              TOP 20 RANKED
            </span>
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto pr-1">
            <table className="w-full text-left border-collapse font-mono">
              <thead className="sticky top-0 bg-[var(--surface)] z-10">
                <tr className="text-[9px] uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]">
                  <th className="py-1.5 px-2">#</th>
                  <th className="py-1.5 px-2">Ticker</th>
                  <th className="py-1.5 px-2">Sector</th>
                  <th className="py-1.5 px-2 text-right">Fund Holders</th>
                  <th className="py-1.5 px-2 text-right">13F Value</th>
                  <th className="py-1.5 px-2 text-right">Inst. %</th>
                  <th className="py-1.5 px-2 text-right">13F Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] text-xs">
                {TOP_20_CONVICTION.map((item) => {
                  const isPositive = item.holderChg.startsWith("+");
                  return (
                    <tr
                      key={item.symbol}
                      onClick={() => onSelectTicker(item.symbol)}
                      className="hover:bg-[var(--hover)] cursor-pointer transition-colors group"
                    >
                      <td className="py-2 px-2 text-[10px] text-[var(--muted)] font-bold">{item.rank}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
                            {item.symbol}
                          </span>
                          <span className="text-[9px] text-[var(--muted)] truncate max-w-[100px]">
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-[10px] text-[var(--muted)]">{item.sector}</td>
                      <td className="py-2 px-2 text-right font-bold text-[var(--fg)]">
                        {item.holders.toLocaleString("en-US")}{" "}
                        <span className={`text-[9px] ${isPositive ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                          ({item.holderChg})
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-[var(--fg)] font-bold">{item.valB}</td>
                      <td className="py-2 px-2 text-right">
                        <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 px-1.5 py-0.5 rounded">
                          {item.instPct}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                            item.trend.includes("Accumulation")
                              ? "bg-[var(--up)]/10 text-[var(--up)] border-[var(--up)]/30"
                              : item.trend.includes("Distribution")
                              ? "bg-[var(--down)]/10 text-[var(--down)] border-[var(--down)]/30"
                              : "bg-[var(--hover)] text-[var(--fg)] border-[var(--line)]"
                          }`}
                        >
                          {item.trend}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
