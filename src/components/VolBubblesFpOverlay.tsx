"use client";

import React from "react";

export interface BacktestCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volMult?: number | null;
}

export interface VolBubblesFpSettings {
  enabled: boolean;
  showBubbles: boolean;
  showRays: boolean;
  showUsOpen: boolean;
  showPriceLine: boolean;
  showFootprint: boolean;
  showFpbs: boolean;
  thresholdMult: number;
  placement: "High/Low" | "Close";
  bubbleTextMode: "Volume" | "Multiple" | "Both";
}

export const DEFAULT_VOL_BUBBLES_FP_SETTINGS: VolBubblesFpSettings = {
  enabled: true,
  showBubbles: true,
  showRays: true,
  showUsOpen: true,
  showPriceLine: true,
  showFootprint: true,
  showFpbs: true,
  thresholdMult: 1.5,
  placement: "High/Low",
  bubbleTextMode: "Volume",
};

interface VolBubblesFpOverlayProps {
  candles: BacktestCandle[];
  logicalToX: (logical: number) => number | null;
  priceToY: (price: number) => number | null;
  chartWidth: number;
  chartHeight: number;
  settings: VolBubblesFpSettings;
}

// =============================================================================
// Helpers (1:1 port of Pine Script "Volume Bubbles & Axia Footprint (SPY/QQQ)")
// =============================================================================

function fmtVol(v: number): string {
  const av = Math.abs(v);
  const sgn = v < 0 ? "-" : "";
  if (av < 0.5) return "0";
  if (av >= 1e9) return sgn + (av / 1e9).toFixed(1) + "B";
  if (av >= 1e7) return sgn + Math.round(av / 1e6) + "M";
  if (av >= 1e6) return sgn + (av / 1e6).toFixed(1) + "M";
  if (av >= 1e4) return sgn + Math.round(av / 1e3) + "K";
  if (av >= 1e3) return sgn + (av / 1e3).toFixed(1) + "K";
  return sgn + Math.round(av);
}

function getBarDir(o: number, h: number, l: number, c: number): number {
  const range = h - l;
  const mid = (h + l) * 0.5;
  if (range <= 0) return 0;
  if (c > mid) return 1;
  if (c < mid) return -1;
  return c > o ? 1 : c < o ? -1 : 0;
}

function getBubblePrice(dir: number, h: number, l: number, c: number, mode: "High/Low" | "Close"): number {
  if (mode === "Close") return c;
  return dir === 1 ? l : dir === -1 ? h : c;
}

function getSizeTier(mult: number, thresh: number): number {
  if (!Number.isFinite(mult) || mult < thresh) return 0;
  if (mult < 2.0) return 1;
  if (mult < 2.8) return 2;
  if (mult < 4.0) return 3;
  return 4;
}

function getDirHex(dir: number): string {
  return dir === 1 ? "#089981" : dir === -1 ? "#F23645" : "#787B86";
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

function lerpColor(hexA: string, hexB: string, tRaw: number): string {
  const t = Math.max(0, Math.min(1, tRaw));
  const a = hexA.replace("#", "");
  const b = hexB.replace("#", "");
  const r1 = parseInt(a.slice(0, 2), 16), g1 = parseInt(a.slice(2, 4), 16), b1 = parseInt(a.slice(4, 6), 16);
  const r2 = parseInt(b.slice(0, 2), 16), g2 = parseInt(b.slice(2, 4), 16), b2 = parseInt(b.slice(4, 6), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function axiaBlueBg(intensity: number): string {
  return lerpColor("#A6BDF8", "#1236C4", intensity);
}

function axiaRedBg(intensity: number): string {
  return lerpColor("#FFB8A3", "#9E1B0E", intensity);
}

function axiaDeltaBg(deltaVal: number, maxAbsRef: number): string {
  const t = maxAbsRef > 0 ? Math.max(0, Math.min(1, Math.abs(deltaVal) / maxAbsRef)) : 0;
  return deltaVal >= 0 ? axiaBlueBg(t) : axiaRedBg(t);
}

function axiaContrastText(intensity: number): string {
  return intensity < 0.34 ? "#0A0D14" : "#ffffff";
}

function medianOf(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) * 0.5;
}

export default function VolBubblesFpOverlay({
  candles,
  logicalToX,
  priceToY,
  chartWidth,
  chartHeight,
  settings,
}: VolBubblesFpOverlayProps) {
  if (!settings.enabled || candles.length === 0 || chartWidth <= 0 || chartHeight <= 0) {
    return null;
  }

  const plotRight = Math.max(0, chartWidth - 65);
  const plotBottom = Math.max(0, chartHeight - 28);

  // Estimate pixel width of a single bar from adjacent bars
  let barPx = 14;
  if (candles.length >= 2) {
    const x0 = logicalToX(0);
    const x1 = logicalToX(1);
    if (x0 !== null && x1 !== null && Math.abs(x1 - x0) > 0.5) {
      barPx = Math.abs(x1 - x0);
    }
  } else {
    const x0 = logicalToX(0);
    const x1 = logicalToX(1);
    if (x0 !== null && x1 !== null && Math.abs(x1 - x0) > 0.5) {
      barPx = Math.abs(x1 - x0);
    }
  }

  // 1. Compute Bubbles, Top 3 S/R Rays, US Open 15m H/L, and DeltaDay across all revealed bars
  interface BubbleItem {
    barIdx: number;
    price: number;
    mult: number;
    vol: number;
    dir: number;
    tier: number;
    broken: boolean;
    brokenIdx: number | null;
  }

  const allBubbles: BubbleItem[] = [];
  const topBubbles: BubbleItem[] = [];

  interface FpBar {
    barIdx: number;
    o: number;
    h: number;
    l: number;
    c: number;
    totVol: number;
    barDelta: number;
    cumDelta: number;
    x: number;
  }

  let sessionCumDelta = 0;
  const fpAllBars: FpBar[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const dir = getBarDir(c.open, c.high, c.low, c.close);
    const mult = c.volMult ?? null;

    if (mult !== null && mult >= settings.thresholdMult && c.volume > 0) {
      const price = getBubblePrice(dir, c.high, c.low, c.close, settings.placement);
      const tier = getSizeTier(mult, settings.thresholdMult);
      const item: BubbleItem = {
        barIdx: i,
        price,
        mult,
        vol: c.volume,
        dir,
        tier,
        broken: false,
        brokenIdx: null,
      };
      allBubbles.push(item);

      // Insert into Top 3 by mult
      let insertIdx = topBubbles.length;
      for (let t = 0; t < topBubbles.length; t++) {
        if (item.mult > topBubbles[t].mult) {
          insertIdx = t;
          break;
        }
      }
      if (insertIdx < 3) {
        topBubbles.splice(insertIdx, 0, { ...item });
        if (topBubbles.length > 3) topBubbles.pop();
      }
    }

    // Check if any active top bubble was closed through by this bar
    const prevClose = i > 0 ? candles[i - 1].close : null;
    for (const b of topBubbles) {
      if (!b.broken && i > b.barIdx) {
        let closedThrough = false;
        if (b.dir === 1) closedThrough = c.close < b.price;
        else if (b.dir === -1) closedThrough = c.close > b.price;
        else if (prevClose !== null) {
          closedThrough =
            (prevClose > b.price && c.close < b.price) ||
            (prevClose < b.price && c.close > b.price);
        }
        if (closedThrough) {
          b.broken = true;
          b.brokenIdx = i;
        }
      }
    }

    // DeltaDay accumulation (Pine Script fallback when no LTF intrabar stream)
    const bRange = c.high - c.low;
    const bFrac = bRange > 0 ? (c.close - c.low) / bRange : c.close >= c.open ? 1.0 : 0.0;
    const barBuyTot = (c.volume || 0) * bFrac;
    const barSellTot = (c.volume || 0) * (1.0 - bFrac);
    const barDelta = barBuyTot - barSellTot;
    sessionCumDelta += barDelta;

    const x = logicalToX(i);
    if (x !== null && x >= -barPx && x <= plotRight + barPx) {
      fpAllBars.push({
        barIdx: i,
        o: c.open,
        h: c.high,
        l: c.low,
        c: c.close,
        totVol: c.volume || 0,
        barDelta,
        cumDelta: sessionCumDelta,
        x,
      });
    }
  }

  // 2. US Open 15m High / Low (first 3 5m candles = 09:30–09:45 ET)
  let usHi: number | null = null;
  let usLo: number | null = null;
  if (settings.showUsOpen && candles.length >= 3) {
    usHi = Math.max(candles[0].high, candles[1].high, candles[2].high);
    usLo = Math.min(candles[0].low, candles[1].low, candles[2].low);
  }

  // 3. Current Price Line
  const lastCandle = candles[candles.length - 1];
  const curPriceY = settings.showPriceLine ? priceToY(lastCandle.close) : null;
  const curPriceCol = lastCandle.close >= lastCandle.open ? "#00D936" : "#EE3322";

  // 4. Footprint Uniform Dynamic Step across visible bars
  const visFpBars = fpAllBars.filter((b) => b.x >= 0 && b.x <= plotRight);
  let gridStep = 0.01;
  let maxWinVol = 0;
  let maxWinDelta = 0;
  let maxWinCum = 0;
  if (visFpBars.length > 0) {
    let winLow = visFpBars[0].l;
    let winHigh = visFpBars[0].h;
    const ranges: number[] = [];
    for (const fb of visFpBars) {
      winLow = Math.min(winLow, fb.l);
      winHigh = Math.max(winHigh, fb.h);
      maxWinVol = Math.max(maxWinVol, fb.totVol);
      maxWinDelta = Math.max(maxWinDelta, Math.abs(fb.barDelta));
      maxWinCum = Math.max(maxWinCum, Math.abs(fb.cumDelta));
      if (fb.h > fb.l) ranges.push(fb.h - fb.l);
    }
    const winSpan = Math.max(winHigh - winLow, 0.1);
    const medRange = ranges.length > 0 ? medianOf(ranges) : winSpan / Math.max(1, visFpBars.length);
    const avgStep = medRange / 7;
    const screenStep = winSpan / 68;
    gridStep = Math.max(0.01, Math.round(Math.max(avgStep, screenStep) / 0.01) * 0.01);
  }

  const showFpCells = settings.showFootprint && barPx >= 46;
  const cellWidth = Math.max(30, Math.min(barPx * 0.88, 96));
  const compactCellText = cellWidth < 58;
  const cellFontSize = cellWidth < 48 ? "7.5px" : cellWidth < 60 ? "8.5px" : "9.5px";

  // Bottom FPBS strip geometry (3 rows of 14px each, right above the time axis)
  const fpbsRowH = 14;
  const fpbsTotalH = fpbsRowH * 3;
  const fpbsTop = plotBottom - fpbsTotalH - 2;
  const fpbsColW = Math.max(4, Math.min(barPx * 0.92, 54));

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      style={{ zIndex: 15 }}
    >
      {/* SVG Layer: Current Price Line, US Open 15m H/L, Top 3 S/R Rays, Footprint Stripes */}
      <svg
        width={plotRight}
        height={plotBottom}
        className="absolute left-0 top-0"
      >
        {/* Current Price Horizontal Line */}
        {curPriceY !== null && curPriceY >= 0 && curPriceY <= plotBottom && (
          <line
            x1={0}
            y1={curPriceY}
            x2={plotRight}
            y2={curPriceY}
            stroke={curPriceCol}
            strokeWidth={1}
            strokeOpacity={0.85}
          />
        )}

        {/* US Open 15m High / Low */}
        {usHi !== null && usLo !== null && (() => {
          const xStart = Math.max(0, logicalToX(2) ?? 0);
          const yHi = priceToY(usHi);
          const yLo = priceToY(usLo);
          return (
            <>
              {yHi !== null && yHi >= 0 && yHi <= plotBottom && (
                <line
                  x1={xStart}
                  y1={yHi}
                  x2={plotRight}
                  y2={yHi}
                  stroke="#FFA726"
                  strokeWidth={2}
                />
              )}
              {yLo !== null && yLo >= 0 && yLo <= plotBottom && (
                <line
                  x1={xStart}
                  y1={yLo}
                  x2={plotRight}
                  y2={yLo}
                  stroke="#FFA726"
                  strokeWidth={2}
                />
              )}
            </>
          );
        })()}

        {/* Top 3 Session S/R Rays */}
        {settings.showRays &&
          topBubbles.map((b, idx) => {
            const y = priceToY(b.price);
            const x1 = logicalToX(b.barIdx);
            if (y === null || x1 === null || y < 0 || y > plotBottom) return null;
            const xStart = Math.max(0, x1);
            const xEnd = b.broken && b.brokenIdx !== null
              ? Math.max(xStart + 4, logicalToX(b.brokenIdx) ?? xStart + 4)
              : plotRight;
            const col = getDirHex(b.dir);
            return (
              <line
                key={`ray-${idx}-${b.barIdx}`}
                x1={xStart}
                y1={y}
                x2={xEnd}
                y2={y}
                stroke={col}
                strokeOpacity={b.broken ? 0.28 : 0.85}
                strokeWidth={b.broken ? 1 : 2}
                strokeDasharray={b.broken ? "2,3" : "6,4"}
              />
            );
          })}

        {/* Footprint Left-Edge Open-to-Close Body Stripes */}
        {settings.showFootprint &&
          visFpBars.map((fb) => {
            const yO = priceToY(fb.o);
            const yC = priceToY(fb.c);
            if (yO === null || yC === null) return null;
            const stripeCol = fb.c >= fb.o ? "#00E639" : "#FF1E1E";
            const stripeX = showFpCells ? fb.x - cellWidth / 2 : fb.x - Math.max(2, barPx * 0.38);
            const y1 = Math.abs(yC - yO) < 2 ? yC - 1.5 : yO;
            const y2 = Math.abs(yC - yO) < 2 ? yC + 1.5 : yC;
            return (
              <line
                key={`fp-stripe-${fb.barIdx}`}
                x1={stripeX}
                y1={y1}
                x2={stripeX}
                y2={y2}
                stroke={fb.c === fb.o ? "#8A909E" : stripeCol}
                strokeWidth={4}
                strokeLinecap="butt"
              />
            );
          })}
      </svg>

      {/* US Open 15m Labels */}
      {usHi !== null && usLo !== null && (() => {
        const yHi = priceToY(usHi);
        const yLo = priceToY(usLo);
        return (
          <>
            {yHi !== null && yHi >= 8 && yHi <= plotBottom - 8 && (
              <div
                style={{
                  position: "absolute",
                  right: 70,
                  top: yHi - 10,
                  background: "rgba(255, 167, 38, 0.88)",
                  color: "#0A0D14",
                  fontSize: "10px",
                  fontWeight: 700,
                  fontFamily: "Consolas, monospace",
                  padding: "1px 5px",
                  borderRadius: "3px",
                  whiteSpace: "nowrap",
                }}
              >
                US H {usHi.toFixed(2)}
              </div>
            )}
            {yLo !== null && yLo >= 8 && yLo <= plotBottom - 8 && (
              <div
                style={{
                  position: "absolute",
                  right: 70,
                  top: yLo - 10,
                  background: "rgba(255, 167, 38, 0.88)",
                  color: "#0A0D14",
                  fontSize: "10px",
                  fontWeight: 700,
                  fontFamily: "Consolas, monospace",
                  padding: "1px 5px",
                  borderRadius: "3px",
                  whiteSpace: "nowrap",
                }}
              >
                US L {usLo.toFixed(2)}
              </div>
            )}
          </>
        );
      })()}

      {/* Top 3 S/R Ray Labels */}
      {settings.showRays &&
        topBubbles.map((b, idx) => {
          const y = priceToY(b.price);
          if (y === null || y < 8 || y > plotBottom - 8) return null;
          const col = getDirHex(b.dir);
          const xBroken = b.broken && b.brokenIdx !== null ? logicalToX(b.brokenIdx) : null;
          return (
            <div
              key={`ray-lbl-${idx}-${b.barIdx}`}
              style={{
                position: "absolute",
                left: b.broken && xBroken !== null ? Math.min(plotRight - 40, Math.max(4, xBroken + 4)) : undefined,
                right: b.broken ? undefined : 70,
                top: y - 10,
                background: b.broken ? "transparent" : hexToRgba(col, 0.85),
                color: b.broken ? hexToRgba(col, 0.5) : "#ffffff",
                fontSize: "10px",
                fontWeight: 700,
                fontFamily: "Consolas, monospace",
                padding: b.broken ? "0px 2px" : "1px 5px",
                borderRadius: "3px",
                whiteSpace: "nowrap",
              }}
            >
              {b.mult.toFixed(1)}×
            </div>
          );
        })}

      {/* Footprint Cells (shown when zoomed in enough for readable Bid x Ask rows) */}
      {showFpCells &&
        visFpBars.map((fb) => {
          const fpLow = Math.floor(fb.l / gridStep + 1e-6) * gridStep;
          let rowH = gridStep;
          let rCount = fb.h > fb.l ? Math.max(1, Math.ceil((fb.h - fpLow) / rowH - 1e-6)) : 1;
          if (rCount > 35) {
            const mult = Math.max(2, Math.ceil((fb.h - fb.l) / (35 * rowH) - 1e-6));
            rowH = gridStep * mult;
            rCount = Math.max(1, Math.ceil((fb.h - fpLow) / rowH - 1e-6));
          }

          const buyFrac = fb.totVol > 0 ? Math.max(0, Math.min(1, (fb.totVol + fb.barDelta) * 0.5 / fb.totVol)) : 0.5;
          const bodyBot = Math.min(fb.o, fb.c);
          const bodyTop = Math.max(fb.o, fb.c);
          const weights: number[] = [];
          let weightSum = 0;
          for (let r = 0; r < rCount; r++) {
            const binMid = fpLow + (r + 0.5) * rowH;
            const w = binMid >= bodyBot && binMid <= bodyTop ? 2.0 : 1.0;
            weights.push(w);
            weightSum += w;
          }

          let maxRowVol = 0;
          let maxRowDelta = 0;
          let pocIdx = 0;
          const rowBuy: number[] = [];
          const rowSell: number[] = [];
          for (let r = 0; r < rCount; r++) {
            const rv = fb.totVol * (weights[r] / (weightSum || 1));
            const bv = rv * buyFrac;
            const sv = rv * (1 - buyFrac);
            rowBuy.push(bv);
            rowSell.push(sv);
            const tot = bv + sv;
            const dlt = Math.abs(bv - sv);
            if (tot > maxRowVol) {
              maxRowVol = tot;
              pocIdx = r;
            }
            if (dlt > maxRowDelta) maxRowDelta = dlt;
          }

          return Array.from({ length: rCount }).map((_, r) => {
            const bv = rowBuy[r];
            const sv = rowSell[r];
            if (bv + sv <= 0) return null;
            const binBot = fpLow + r * rowH;
            const binTop = binBot + rowH;
            const yTop = priceToY(binTop);
            const yBot = priceToY(binBot);
            if (yTop === null || yBot === null) return null;
            const boxH = Math.max(10, Math.abs(yBot - yTop));
            const rowDelta = bv - sv;
            const isPoc = r === pocIdx;
            // Only flag row-level 4x Bid/Ask imbalances when true intrabar data is present;
            // with 5m OHLCV-only fallback, applying bar-level buyFrac to every row would falsely flood the whole candle.
            const hasIntrabar = false;
            const buyImb = hasIntrabar && (sv <= 0 ? bv > 0 : bv >= sv * 4.0);
            const sellImb = hasIntrabar && (bv <= 0 ? sv > 0 : sv >= bv * 4.0);
            const isImb = buyImb || sellImb;
            const intensity = maxRowDelta > 0 ? Math.min(1, Math.abs(rowDelta) / maxRowDelta) : 0;

            const bgCol = buyImb
              ? "#00A846"
              : sellImb
              ? "#D91414"
              : isPoc
              ? rowDelta >= 0
                ? "#0C217A"
                : "#4A0E08"
              : rowDelta >= 0
              ? axiaBlueBg(intensity)
              : axiaRedBg(intensity);
            const txtC = isImb || isPoc ? "#ffffff" : axiaContrastText(intensity);
            const cellLabel = compactCellText
              ? `${fmtVol(sv)}×${fmtVol(bv)}`
              : `${fmtVol(sv)} x ${fmtVol(bv)}`;

            return (
              <div
                key={`fp-${fb.barIdx}-${r}`}
                style={{
                  position: "absolute",
                  left: fb.x - cellWidth / 2 + 2,
                  top: Math.min(yTop, yBot),
                  width: cellWidth - 2,
                  height: boxH,
                  background: bgCol,
                  border: `${isImb ? 2 : 1}px solid #000000`,
                  color: txtC,
                  fontSize: boxH < 13 ? "7.5px" : cellFontSize,
                  fontWeight: isImb || isPoc ? 700 : 400,
                  fontFamily: "Consolas, monospace",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                {cellLabel}
              </div>
            );
          });
        })}

      {/* Top-Layer Volume Bubbles + White Volume Numbers */}
      {settings.showBubbles &&
        allBubbles.map((b) => {
          const x = logicalToX(b.barIdx);
          const y = priceToY(b.price);
          if (x === null || y === null || x < -30 || x > plotRight + 30 || y < -30 || y > plotBottom + 30) {
            return null;
          }
          const baseHex = getDirHex(b.dir);
          const topRef = Math.max(settings.thresholdMult + 2.5, 4.0);
          const ratio = Math.max(0, Math.min(1, (b.mult - settings.thresholdMult) / (topRef - settings.thresholdMult)));
          const transp = Math.round(30 - ratio * 25);
          const alpha = (100 - transp) / 100;
          const diam = b.tier === 4 ? 42 : b.tier === 3 ? 34 : b.tier === 2 ? 28 : 22;

          const labelText =
            settings.bubbleTextMode === "Volume"
              ? fmtVol(b.vol)
              : settings.bubbleTextMode === "Multiple"
              ? `${b.mult.toFixed(1)}×`
              : `${fmtVol(b.vol)}\n${b.mult.toFixed(1)}×`;

          return (
            <div
              key={`bub-${b.barIdx}`}
              style={{
                position: "absolute",
                left: x - diam / 2,
                top: y - diam / 2,
                width: diam,
                height: diam,
                borderRadius: "50%",
                background: hexToRgba(baseHex, alpha),
                border: `1px solid ${hexToRgba(baseHex, Math.min(1, alpha + 0.2))}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                color: "#ffffff",
                fontSize: diam >= 34 ? "9.5px" : "8.5px",
                fontWeight: 700,
                fontFamily: "Consolas, monospace",
                lineHeight: 1.05,
                whiteSpace: "pre-line",
                boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
              }}
            >
              {labelText}
            </div>
          );
        })}

      {/* Aligned 3-Row Bottom FPBS Summary Strip (Volume / Delta / DeltaDay) */}
      {settings.showFpbs && visFpBars.length > 0 && fpbsTop > 40 && (
        <>
          {visFpBars.map((d) => {
            const volInt = maxWinVol > 0 ? Math.min(1, d.totVol / maxWinVol) : 0;
            const dltInt = maxWinDelta > 0 ? Math.min(1, Math.abs(d.barDelta) / maxWinDelta) : 0;
            const cumInt = maxWinCum > 0 ? Math.min(1, Math.abs(d.cumDelta) / maxWinCum) : 0;
            const showTxt = fpbsColW >= 24;

            return (
              <React.Fragment key={`fpbs-${d.barIdx}`}>
                <div
                  style={{
                    position: "absolute",
                    left: d.x - fpbsColW / 2,
                    top: fpbsTop,
                    width: fpbsColW,
                    height: fpbsRowH,
                    background: axiaBlueBg(volInt),
                    border: "1px solid #222630",
                    color: axiaContrastText(volInt),
                    fontSize: "8.5px",
                    fontFamily: "Consolas, monospace",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {showTxt ? fmtVol(d.totVol) : ""}
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: d.x - fpbsColW / 2,
                    top: fpbsTop + fpbsRowH,
                    width: fpbsColW,
                    height: fpbsRowH,
                    background: axiaDeltaBg(d.barDelta, maxWinDelta),
                    border: "1px solid #222630",
                    color: axiaContrastText(dltInt),
                    fontSize: "8.5px",
                    fontFamily: "Consolas, monospace",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {showTxt ? fmtVol(d.barDelta) : ""}
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: d.x - fpbsColW / 2,
                    top: fpbsTop + fpbsRowH * 2,
                    width: fpbsColW,
                    height: fpbsRowH,
                    background: axiaDeltaBg(d.cumDelta, maxWinCum),
                    border: "1px solid #222630",
                    color: axiaContrastText(cumInt),
                    fontSize: "8.5px",
                    fontFamily: "Consolas, monospace",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {showTxt ? fmtVol(d.cumDelta) : ""}
                </div>
              </React.Fragment>
            );
          })}

          {/* Right-side FPBS Row Labels */}
          {[
            { label: "Volume", bg: "#1E4AD8", top: fpbsTop },
            { label: "Delta", bg: "#1E4AD8", top: fpbsTop + fpbsRowH },
            { label: "DeltaDay", bg: "#2A2E39", top: fpbsTop + fpbsRowH * 2 },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                position: "absolute",
                right: 68,
                top: row.top,
                width: 52,
                height: fpbsRowH,
                background: row.bg,
                border: "1px solid #222630",
                color: "#ffffff",
                fontSize: "8.5px",
                fontWeight: 700,
                fontFamily: "Consolas, monospace",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {row.label}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
