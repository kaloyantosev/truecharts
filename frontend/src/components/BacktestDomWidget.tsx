"use client";

import React, { useRef, useEffect } from "react";

export interface DomRow {
  strike: number;
  put_oi: number;
  call_oi: number;
  call_vol?: number;
  put_vol?: number;
  put_bar_pct: number;
  call_bar_pct: number;
  put_0dte_pct: number;
  call_0dte_pct: number;
  put_0dte_oi: number;
  call_0dte_oi: number;
  is_spot: boolean;
}

export interface SinclairStats {
  vrp_spread: number;
  weekly_expected_move_dollars: number;
  implied_volatility: number;
  rv_yang_zhang: number;
}

interface BacktestDomWidgetProps {
  ticker: string;
  selectedDate?: string;
  sinclair?: SinclairStats;
  domData?: {
    "0dte": DomRow[];
    weekly: DomRow[];
  };
  spot: number;
  isBlindMode?: boolean;
}

function fmtK(n: number): string {
  if (!n) return "";
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(Math.round(n));
}

function findWall(rows: DomRow[], ref: number, side: "call" | "put") {
  const col = side === "call" ? "call_oi" : "put_oi";
  const cand = rows.filter((r) => (side === "call" ? r.strike > ref : r.strike < ref));
  if (cand.length === 0) return null;
  let best = cand[0];
  for (const r of cand) {
    if ((r[col] || 0) > (best[col] || 0)) best = r;
  }
  const bestOi = best[col] || 0;
  if (bestOi <= 0) return null;
  const neighbours = rows
    .filter(
      (r) =>
        r.strike !== best.strike &&
        ref > 0 &&
        Math.abs(r.strike - best.strike) / ref <= 0.003 &&
        (r[col] || 0) >= 0.5 * bestOi
    )
    .map((r) => r.strike);
  return {
    strike: best.strike,
    oi: bestOi,
    stacked: neighbours.length > 0,
    neighbours,
  };
}

export default function BacktestDomWidget({
  ticker,
  selectedDate,
  domData,
  spot,
  isBlindMode = false,
}: BacktestDomWidgetProps) {
  const spotRef = useRef<HTMLDivElement>(null);

  // Match D:\Truecharts\desktop\tv_automation.py: weekly OI sorted descending by strike
  const rows = [...(domData?.weekly || [])].sort((a, b) => b.strike - a.strike);

  // Find strike closest to current/spot price
  let atPxStrike: number | null = null;
  if (rows.length > 0) {
    const refPrice = spot > 0 ? spot : rows[Math.floor(rows.length / 2)].strike;
    let bestDiff = Infinity;
    for (const r of rows) {
      const d = Math.abs(r.strike - refPrice);
      if (d < bestDiff) {
        bestDiff = d;
        atPxStrike = r.strike;
      }
    }
  }

  const ref = spot > 0 ? spot : atPxStrike || 0;
  const cw = ref > 0 ? findWall(rows, ref, "call") : null;
  const pw = ref > 0 ? findWall(rows, ref, "put") : null;
  const stacked = new Set<number>([
    ...(cw && cw.stacked ? cw.neighbours : []),
    ...(pw && pw.stacked ? pw.neighbours : []),
  ]);

  const mx = rows.reduce((m, r) => Math.max(m, r.call_oi || 0, r.put_oi || 0), 1);

  // Auto-scroll closest strike to center of ladder
  useEffect(() => {
    if (spotRef.current) {
      spotRef.current.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [domData, atPxStrike]);

  const timeLabel = isBlindMode ? "weekly OI 09:40" : `weekly OI ${selectedDate ? "09:40" : ""}`.trim();

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "transparent",
        color: "#e2e8f0",
        fontFamily: "Segoe UI, Arial, sans-serif",
        fontSize: "12px",
        lineHeight: 1.35,
        overflow: "hidden",
      }}
    >
      {/* Header matching D:\Truecharts\desktop\tv_automation.py (#tc-options-dom) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
          paddingBottom: "4px",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <b style={{ fontSize: "12px", color: "#e2e8f0" }}>{ticker} · option chain</b>
        <span style={{ color: "#64748b", fontSize: "10px" }}>{timeLabel}</span>
      </div>

      {/* Column Headers: PUT OI | STRIKE | CALL OI | NET */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 58px 1fr 50px",
          fontSize: "10px",
          color: "#94a3b8",
          fontWeight: 700,
          marginBottom: "3px",
        }}
      >
        <span style={{ color: "#10b981", paddingLeft: "3px" }}>PUT OI</span>
        <span style={{ textAlign: "center" }}>STRIKE</span>
        <span style={{ color: "#ef4444", textAlign: "right", paddingRight: "3px" }}>CALL OI</span>
        <span style={{ textAlign: "right" }}>NET</span>
      </div>

      {/* Ladder Rows */}
      <div
        className="flex-1 overflow-y-auto flex flex-col pr-0.5"
        style={{ display: "flex", flexDirection: "column", overflowY: "auto", flex: "1 1 0%", minHeight: 0 }}
      >
        {rows.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: "11px", textAlign: "center", padding: "12px 0" }}>
            No chain yet
          </div>
        ) : (
          rows.map((r) => {
            const net = (r.call_oi || 0) - (r.put_oi || 0);
            const atPx = r.strike === atPxStrike;
            const isCw = Boolean(cw && r.strike === cw.strike);
            const isPw = Boolean(pw && r.strike === pw.strike);
            const boxShadow = isCw
              ? "inset 0 0 0 1px #ef4444"
              : isPw
              ? "inset 0 0 0 1px #10b981"
              : undefined;
            const mark = stacked.has(r.strike) ? " ◆" : "";

            const putPct = Math.min(100, (100 * (r.put_oi || 0)) / mx);
            const callPct = Math.min(100, (100 * (r.call_oi || 0)) / mx);

            return (
              <div
                key={r.strike}
                ref={atPx ? spotRef : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 58px 1fr 50px",
                  alignItems: "center",
                  height: "18px",
                  minHeight: "18px",
                  margin: "1px 0",
                  fontFamily: "Consolas, monospace",
                  fontSize: "11px",
                  background: atPx ? "rgba(56,189,248,0.2)" : undefined,
                  boxShadow,
                }}
              >
                {/* PUT OI */}
                <div style={{ position: "relative", height: "13px", display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: `${putPct}%`,
                      background: `rgba(16,185,129,${isPw ? 0.9 : 0.5})`,
                    }}
                  />
                  <span style={{ position: "relative", paddingLeft: "3px", color: "#e2e8f0" }}>
                    {fmtK(r.put_oi)}
                  </span>
                </div>

                {/* STRIKE */}
                <div
                  style={{
                    textAlign: "center",
                    color: atPx ? "#38bdf8" : "#e2e8f0",
                    fontWeight: "bold",
                  }}
                >
                  {r.strike}
                  {mark}
                </div>

                {/* CALL OI */}
                <div style={{ position: "relative", height: "13px", display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${callPct}%`,
                      background: `rgba(239,68,68,${isCw ? 0.9 : 0.5})`,
                    }}
                  />
                  <span style={{ position: "absolute", right: "3px", color: "#e2e8f0" }}>
                    {fmtK(r.call_oi)}
                  </span>
                </div>

                {/* NET */}
                <div
                  style={{
                    textAlign: "right",
                    color: net > 0 ? "#f87171" : "#34d399",
                  }}
                >
                  {net ? (net > 0 ? "+" : "−") + fmtK(Math.abs(net)) : ""}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
