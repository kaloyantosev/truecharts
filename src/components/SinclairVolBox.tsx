"use client";

import React from "react";

export interface SinclairVolatility {
  rv_yang_zhang: number;
  implied_volatility: number;
  vrp_spread: number;
  vrp_pct: number;
  iv_rank: number;
  ivts: number;
  term_structure_regime: string;
  skew_slope: number;
  skew_bias: string;
  weekly_expected_move_dollars?: number;
  weekly_expected_move_pct?: number;
  regime_verdict: string;
  vol_edge: string;
}

interface Props {
  volData?: SinclairVolatility;
  spot?: number;
  ticker?: string;
}

export default function SinclairVolBox({ volData, spot, ticker }: Props) {
  if (!volData) {
    return null;
  }

  const relPct = volData.vrp_pct !== undefined ? volData.vrp_pct : ((volData.vrp_spread / (volData.rv_yang_zhang || NaN)) * 100);
  const isChop = relPct >= 15.0 || volData.vrp_spread >= 2.5;
  const isTrend = relPct <= -12.0 || volData.vrp_spread <= -2.0;
  const isStress = volData.ivts > 1.05 || volData.term_structure_regime.toLowerCase().includes("backwardation");

  let simpleRegime = "Neutral";
  let badgeColor = "bg-slate-500/10 border-slate-500/30 text-[var(--fg)]";
  if (isStress) {
    simpleRegime = "Event Shock";
    badgeColor = "bg-[var(--down)]/10 border-[var(--down)]/30 text-[var(--down)]";
  } else if (isChop) {
    simpleRegime = "Range-Bound (Chop)";
    badgeColor = "bg-[var(--up)]/10 border-[var(--up)]/30 text-[var(--up)]";
  } else if (isTrend) {
    simpleRegime = "Trend (Breakout)";
    badgeColor = "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]";
  }

  const vrpLabel = isChop ? "Chop" : (isTrend ? "Trend" : "Neutral");
  const vrpColor = isChop ? "text-[var(--up)]" : (isTrend ? "text-[var(--accent)]" : "text-[var(--fg)]");

  let simpleTerm = "Flat";
  let termColor = "text-[var(--violet)]";
  if (isStress) {
    simpleTerm = "Stress";
    termColor = "text-[var(--down)]";
  } else if (volData.ivts < 0.95 || volData.term_structure_regime.toLowerCase().includes("contango")) {
    simpleTerm = "Normal";
    termColor = "text-[var(--up)]";
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-4 font-mono flex flex-col gap-3">
      {/* Top Banner: Regime Verdict & Weekly Move */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--line)] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">
            Sinclair Volatility Regime
          </span>
          {volData.weekly_expected_move_dollars && (
            <span className="text-[10px] text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded border border-[var(--accent)]/30 font-bold ml-1">
              Weekly Move: ±${volData.weekly_expected_move_dollars.toFixed(2)} ({volData.weekly_expected_move_pct}%)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${badgeColor}`}>
            {simpleRegime}
          </span>
          <span className="text-[10px] text-[var(--muted)] bg-[var(--hover)] px-2 py-0.5 rounded border border-[var(--line)]">
            {isChop ? "Fade Extremes (Buy Dips / Short Rips)" : (isTrend ? "Play Momentum (Buy Breakouts / Short Breaks)" : "Trade Levels")}
          </span>
        </div>
      </div>

      {/* Core 3-Column Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. IV vs Realized Vol (Yang-Zhang) */}
        <div className="bg-[var(--bg)] border border-[var(--line)] rounded p-2.5 flex flex-col justify-between">
          <span className="text-[10px] text-[var(--muted)] uppercase">Implied vs Realized (YZ)</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-bold text-[var(--fg)]">{volData.implied_volatility.toFixed(1)}%</span>
            <span className="text-xs text-[var(--muted)]">IV</span>
            <span className="text-[var(--muted)] text-xs">/</span>
            <span className="text-base font-bold text-[var(--fg)]">{volData.rv_yang_zhang.toFixed(1)}%</span>
            <span className="text-xs text-[var(--muted)]">RV</span>
          </div>
          <span className="text-[10px] text-[var(--muted)] mt-1">
            Yang-Zhang (30d Drift & Jump Adjusted)
          </span>
        </div>

        {/* 2. Variance Risk Premium (VRP Edge) */}
        <div className="bg-[var(--bg)] border border-[var(--line)] rounded p-2.5 flex flex-col justify-between">
          <span className="text-[10px] text-[var(--muted)] uppercase">Variance Risk Premium (VRP)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-base font-bold ${vrpColor}`}>
              {volData.vrp_spread >= 0 ? `+${volData.vrp_spread.toFixed(1)}` : volData.vrp_spread.toFixed(1)}
            </span>
            <span className="text-xs text-[var(--muted)]">pts</span>
            <span className={`text-xs font-bold ml-1 ${vrpColor}`}>
              ({vrpLabel})
            </span>
          </div>
          <span className="text-[10px] text-[var(--muted)] mt-1">
            {isChop ? "Range Bound · Expect Choppy Reversals" : (isTrend ? "Coiled Spring · Expect Directional Breakouts" : "Fair Price Movement")}
          </span>
        </div>

        {/* 3. Term Structure & Skew */}
        <div className="bg-[var(--bg)] border border-[var(--line)] rounded p-2.5 flex flex-col justify-between">
          <span className="text-[10px] text-[var(--muted)] uppercase">Term Structure & Skew</span>
          <div className="flex items-baseline justify-between mt-1">
            <div>
              <span className="text-xs text-[var(--muted)]">Term: </span>
              <span className={`text-xs font-bold ${termColor}`}>
                {simpleTerm}
              </span>
            </div>
            <div>
              <span className="text-xs text-[var(--muted)]">IVR: </span>
              <span className="text-xs font-bold text-[var(--fg)]">{volData.iv_rank}%</span>
            </div>
          </div>
          <span className="text-[10px] text-[var(--muted)] mt-1 truncate" title={volData.skew_bias}>
            Skew: {volData.skew_bias}
          </span>
        </div>
      </div>
    </div>
  );
}
