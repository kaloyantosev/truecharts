"use client";

import React, { useMemo } from "react";
import { MACRO } from "@/data/macroData";

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const signed = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;

/** S&P 500 weekly closes (last 12 months) as an SVG path, with Fed decisions marked. */
function SpxPath() {
  const { path, marks } = useMemo(() => {
    const pts = MACRO.spx.points;
    if (pts.length < 2) return { path: "", marks: [] as { x: number; y: number; type: string }[] };
    const vals = pts.map((p) => p[1]);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const x = (i: number) => 6 + (i / (pts.length - 1)) * 288;
    const y = (v: number) => 82 - ((v - lo) / (hi - lo || 1)) * 72;
    const path = pts.map((p, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(" ");
    const marks = MACRO.policyEvents
      .map((ev) => {
        const i = pts.findIndex((p) => p[0] >= ev.date);
        return i >= 0 ? { x: x(i), y: y(pts[i][1]), type: ev.type } : null;
      })
      .filter(Boolean) as { x: number; y: number; type: string }[];
    return { path, marks };
  }, []);

  return (
    <svg className="w-full h-28" viewBox="0 0 300 90" fill="none" role="img" aria-label="S&P 500, last 12 months">
      <line x1="0" y1="25" x2="300" y2="25" stroke="var(--line)" strokeDasharray="3 3" />
      <line x1="0" y1="55" x2="300" y2="55" stroke="var(--line)" strokeDasharray="3 3" />
      <path d={path} stroke="var(--accent)" strokeWidth="1.75" fill="none" />
      {marks.map((m, i) => (
        <circle key={i} cx={m.x} cy={m.y} r="3" fill={m.type === "bullish" ? "var(--up)" : "var(--down)"} />
      ))}
    </svg>
  );
}

export default function MacroNarrativeDashboard() {
  const { rates, liquidity: liq, cot, policyEvents, spx } = MACRO;
  const expanding = liq.regime === "Expanding";

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-5 flex flex-col gap-5">
      {/* Module Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--muted)] font-semibold text-xs">MODULE 4</span>
            <h2 className="text-sm font-semibold text-[var(--fg)]">Macro Narrative &amp; Liquidity Dashboard</h2>
          </div>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Policy rates, net USD liquidity and COT positioning · updated automatically from FRED and the CFTC · as of {MACRO.asOf}
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
            expanding
              ? "text-[var(--up)] border-[var(--up)]/40 bg-[var(--up)]/10"
              : "text-[var(--down)] border-[var(--down)]/40 bg-[var(--down)]/10"
          }`}
        >
          {expanding ? "Expanding" : "Contracting"} liquidity
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* PANEL 1: Central Bank Policy Tracker */}
        <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
            <h3 className="text-xs font-semibold text-[var(--fg)] uppercase tracking-wide">Central Bank Policy Tracker</h3>
            <span className="text-[11px] text-[var(--muted)]">Last 12 months</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "US Fed", ...rates.fed },
              { ...rates.ecb },
              { ...rates.us10y },
            ].map((r) => (
              <div key={r.label} className="bg-[var(--surface)] border border-[var(--line)] p-2 rounded-md text-center" title={`As of ${r.date}`}>
                <span className="text-[10px] text-[var(--muted)] block uppercase">{r.label}</span>
                <span className="text-xs font-semibold text-[var(--fg)]">{r.value}</span>
              </div>
            ))}
          </div>

          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-md p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span>S&amp;P 500 with Fed decisions</span>
              {spx.chg12m != null && (
                <span className={spx.chg12m >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}>{signed(spx.chg12m)}% over 12M</span>
              )}
            </div>
            <SpxPath />
            <div className="flex flex-col gap-1.5 text-[11px]">
              {policyEvents.length === 0 && <span className="text-[var(--muted)]">No Fed rate changes in the last 24 months.</span>}
              {[...policyEvents].reverse().slice(0, 4).map((ev) => (
                <div key={ev.date} className="flex items-center justify-between border-b border-[var(--line)] pb-1 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--muted)]">{fmtDate(ev.date)}</span>
                    <span className="text-[var(--fg)] font-medium">{ev.label}</span>
                  </div>
                  <span className={ev.type === "bullish" ? "text-[var(--up)] font-semibold" : "text-[var(--down)] font-semibold"}>{ev.fed}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PANEL 2: Liquidity Conditions */}
        <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
            <h3 className="text-xs font-semibold text-[var(--fg)] uppercase tracking-wide">Liquidity Conditions &amp; QT/QE Gauge</h3>
            <span className="text-[11px] text-[var(--muted)]">Fed H.4.1 · M2</span>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-md p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Net liquidity, 13-week change</span>
              <span className={`text-sm font-semibold ${expanding ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                {signed(liq.netLiquidity13wPct)}% · {liq.regime}
              </span>
            </div>
            <span className={`w-3 h-3 rounded-full ${expanding ? "bg-[var(--up)]" : "bg-[var(--down)]"}`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--surface)] border border-[var(--line)] p-2.5 rounded-md flex flex-col gap-1">
              <span className="text-[10px] text-[var(--muted)] uppercase">Fed total assets</span>
              <span className="text-base font-semibold text-[var(--fg)]">${liq.fedAssetsT.toFixed(2)}T</span>
              <span className="text-[10px] text-[var(--muted)]">
                {signed(liq.fedAssets4wChangeB, 0)}B over 4 weeks · {fmtDay(liq.fedAssetsDate)}
              </span>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--line)] p-2.5 rounded-md flex flex-col gap-1">
              <span className="text-[10px] text-[var(--muted)] uppercase">US M2 money supply</span>
              <span className={`text-base font-semibold ${liq.m2YoY >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{signed(liq.m2YoY)}% YoY</span>
              <span className="text-[10px] text-[var(--muted)]">{fmtDate(liq.m2Date)}</span>
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-md p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs border-b border-[var(--line)] pb-1.5">
              <span className="text-[var(--muted)]">Net USD liquidity</span>
              <span className="text-[var(--fg)] font-semibold">${liq.netLiquidityT.toFixed(2)}T</span>
            </div>
            <div className="text-[10px] text-[var(--muted)] flex justify-between gap-2">
              <span>Fed assets − reverse repo − Treasury General Account</span>
              {liq.spxCorr52w != null && (
                <span title="Correlation of weekly changes in net liquidity and the S&P 500 over the last 52 weeks">
                  52w corr. with S&amp;P {liq.spxCorr52w.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* PANEL 3: COT Positioning */}
        <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
            <h3 className="text-xs font-semibold text-[var(--fg)] uppercase tracking-wide">COT Institutional Positioning</h3>
            <span className="text-[11px] text-[var(--muted)]">CFTC weekly</span>
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Commercial net position as % of open interest, ranked against its last 52 weeks
            {cot[0] ? ` · report of ${fmtDay(cot[0].reportDate)}` : ""}
          </p>

          <div className="flex flex-col gap-2.5">
            {cot.length === 0 && <span className="text-xs text-[var(--muted)]">COT data unavailable.</span>}
            {cot.map((c) => {
              const high = c.percentile >= 70;
              const low = c.percentile <= 30;
              return (
                <div key={c.symbol} className="bg-[var(--surface)] border border-[var(--line)] rounded-md p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--fg)] bg-[var(--hover)] px-1.5 py-0.5 rounded border border-[var(--line)]">{c.symbol}</span>
                      <span className="text-[11px] text-[var(--muted)]">{c.name}</span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase border ${
                        high
                          ? "bg-[var(--up)]/10 text-[var(--up)] border-[var(--up)]/30"
                          : low
                          ? "bg-[var(--down)]/10 text-[var(--down)] border-[var(--down)]/30"
                          : "bg-[var(--hover)] text-[var(--muted)] border-[var(--line)]"
                      }`}
                    >
                      {c.signal}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--muted)]">Net commercial: {signed(c.netCommPct)}%</span>
                    <span className="text-[var(--fg)] font-medium">52W percentile: {c.percentile}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--hover)] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${high ? "bg-[var(--up)]" : low ? "bg-[var(--down)]" : "bg-[var(--accent)]"}`}
                      style={{ width: `${c.percentile}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
