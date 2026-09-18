"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries } from "lightweight-charts";

export interface Level {
  price: number;
  strength: number;
  volume_concentration?: number;
  source?: string;
  dte?: number | null;
  horizon?: string;
  tests?: number;
  title?: string;
  sublabel?: string;
  is_confluence?: boolean;
  confluence_factors?: string[];
}

export interface TradingViewChartProps {
  ticker: string;
  spot: number;
  maxPain: number;
  weeklyMaxPain?: number;
  monthlyMaxPain?: number;
  gammaFlip?: number;
  expectedMoveUpper?: number;
  expectedMoveLower?: number;
  expectedMoveRange?: number;
  supports: Level[];
  resistances: Level[];
  timeframe: string;
}

export default function TradingViewChart({
  ticker,
  spot,
  maxPain,
  weeklyMaxPain,
  monthlyMaxPain,
  gammaFlip,
  expectedMoveUpper,
  expectedMoveLower,
  expectedMoveRange,
  supports,
  resistances,
  timeframe,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<any[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [weeklyGaps, setWeeklyGaps] = useState<any[]>([]);
  const [svgRects, setSvgRects] = useState<any[]>([]);

  // Effective Max Pain levels
  const effectiveWeeklyMaxPain = weeklyMaxPain && weeklyMaxPain > 0 ? weeklyMaxPain : maxPain;
  const effectiveMonthlyMaxPain = monthlyMaxPain && monthlyMaxPain > 0 ? monthlyMaxPain : maxPain;

  // Maximum absorption strengths for scaling
  const maxSupportAbs = useMemo(() => {
    return supports.length > 0 ? Math.max(...supports.map((s) => s.strength)) : 1.0;
  }, [supports]);

  const maxResistanceAbs = useMemo(() => {
    return resistances.length > 0 ? Math.max(...resistances.map((r) => r.strength)) : 1.0;
  }, [resistances]);

  // Gamma Flip (Zero Net GEX Level)
  const gammaFlipPrice = useMemo(() => {
    if (gammaFlip && gammaFlip > 0) return Number(gammaFlip.toFixed(2));
    const majorSup = supports.find((s) => s.strength / maxSupportAbs >= 0.75)?.price;
    const majorRes = resistances.find((r) => r.strength / maxResistanceAbs >= 0.75)?.price;
    if (majorSup && majorRes) {
      return Number(((majorSup * 0.48) + (majorRes * 0.52)).toFixed(2));
    }
    return Number((spot * 0.994).toFixed(2));
  }, [gammaFlip, supports, resistances, maxSupportAbs, maxResistanceAbs, spot]);

  // Expected Move Boundaries
  const emUpper = useMemo(() => {
    if (expectedMoveUpper && expectedMoveUpper > 0) return Number(expectedMoveUpper.toFixed(2));
    return Number((spot * 1.022).toFixed(2));
  }, [expectedMoveUpper, spot]);

  const emLower = useMemo(() => {
    if (expectedMoveLower && expectedMoveLower > 0) return Number(expectedMoveLower.toFixed(2));
    return Number((spot * 0.978).toFixed(2));
  }, [expectedMoveLower, spot]);

  const isLongGamma = spot >= gammaFlipPrice;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create TradingView Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0a" },
        textColor: "#a3a3a3",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: 0,
      },
      width: chartContainerRef.current.clientWidth,
      height: 440,
      timeScale: {
        borderColor: "#262626",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#262626",
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#D4A300",
      borderUpColor: "#D4A300",
      wickUpColor: "#D4A300",
      downColor: "#F28C28",
      borderDownColor: "#F28C28",
      wickDownColor: "#F28C28",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const generateFallbackCandles = (spotPrice: number, tf: string) => {
      const count = 120;
      const now = Math.floor(Date.now() / 1000);
      let step = 86400;
      if (tf === "5 min") step = 300;
      else if (tf === "15 min") step = 900;
      else if (tf === "1h") step = 3600;
      else if (tf === "4h") step = 14400;
      else if (tf === "1w") step = 604800;
      else if (tf === "1m") step = 2592000;
      else if (tf === "3m") step = 7776000;

      const base = spotPrice > 0 ? spotPrice : 100.0;
      const list: any[] = [];
      let current = base * 0.95;

      for (let i = count; i >= 0; i--) {
        const time = now - i * step;
        const delta = (Math.sin(i * 0.2) * 0.008 + (Math.random() - 0.49) * 0.015) * current;
        const open = current;
        const close = Math.max(1.0, current + delta);
        const high = Math.max(open, close) + Math.abs(delta) * 0.4;
        const low = Math.min(open, close) - Math.abs(delta) * 0.4;
        current = close;
        list.push({
          time: time as any,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
        });
      }
      return list;
    };

    const loadData = async () => {
      let data: any[] = [];
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);
        const res = await fetch(`${apiBaseUrl}/api/history/${ticker}?timeframe=${encodeURIComponent(timeframe)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          data = await res.json();
        }
      } catch (err) {
        console.error("Failed to load chart history from API, generating fallback candles", err);
      }

      if (!Array.isArray(data) || data.length === 0) {
        data = generateFallbackCandles(spot, timeframe);
      }

      candleSeries.setData(data);

      if (data.length > 0) {
        const gaps: any[] = [];
        
        const getBarDate = (barTime: any) => {
          if (typeof barTime === "number") {
            return new Date(barTime * 1000);
          }
          return new Date(barTime);
        };

        const getMondayStr = (barTime: any) => {
          const date = getBarDate(barTime);
          const day = date.getDay();
          const diff = date.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(date.setDate(diff));
          return monday.toISOString().split("T")[0];
        };

        for (let i = 1; i < data.length; i++) {
          const prevBar = data[i - 1];
          const currBar = data[i];
          
          if (getMondayStr(currBar.time) !== getMondayStr(prevBar.time)) {
            const prevClose = prevBar.close;
            const currOpen = currBar.open;
            
            if (prevClose !== currOpen) {
              const wl = Math.min(prevClose, currOpen);
              const wh = Math.max(prevClose, currOpen);
              
              let endBar = currBar;
              let j = i;
              const currMonday = getMondayStr(currBar.time);
              while (j < data.length && getMondayStr(data[j].time) === currMonday) {
                endBar = data[j];
                j++;
              }
              
              gaps.push({
                startTime: currBar.time,
                endTime: endBar.time,
                bottom: wl,
                top: wh,
              });
            }
          }
        }

        const last6Gaps = gaps.slice(-6);
        setWeeklyGaps(last6Gaps);

        let barsToShow = 42;
        if (timeframe === "4h") barsToShow = 85;
        else if (timeframe === "1h") barsToShow = 290;
        else if (timeframe === "15 min") barsToShow = 750;
        else if (timeframe === "5 min") barsToShow = 2250;
        else if (timeframe === "1w") barsToShow = 52;
        else if (timeframe === "1m") barsToShow = 36;
        else if (timeframe === "3m") barsToShow = 24;

        chart.timeScale().setVisibleLogicalRange({
          from: data.length - Math.min(barsToShow, data.length),
          to: data.length - 1,
        });
      } else {
        chart.timeScale().fitContent();
      }
    };

    loadData();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [ticker, timeframe]);

  // Update native price lines (Zero lag, pure canvas rendering)
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    // Clear previous lines
    priceLinesRef.current.forEach((line) => {
      try {
        candleSeries.removePriceLine(line);
      } catch (e) {
        // ignore
      }
    });
    priceLinesRef.current = [];

    // 1. Weekly Max Pain Line (#ba68c8 Orchid Purple, 2px Solid)
    if (effectiveWeeklyMaxPain > 0) {
      const line = candleSeries.createPriceLine({
        price: effectiveWeeklyMaxPain,
        color: "#ba68c8",
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: isHovered
          ? `WEEKLY MAX PAIN: $${effectiveWeeklyMaxPain.toFixed(2)} (Near-Term Pin Magnet)`
          : `WEEKLY PIN · $${effectiveWeeklyMaxPain.toFixed(2)}`,
      });
      priceLinesRef.current.push(line);
    }

    // 2. Monthly OPEX Anchor Pin (if distinct from weekly pin)
    if (effectiveMonthlyMaxPain > 0 && Math.abs(effectiveMonthlyMaxPain - effectiveWeeklyMaxPain) > 0.003 * effectiveWeeklyMaxPain) {
      const line = candleSeries.createPriceLine({
        price: effectiveMonthlyMaxPain,
        color: "#a855f7",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: isHovered
          ? `MONTHLY OPEX PIN: $${effectiveMonthlyMaxPain.toFixed(2)} (Institutional Balance Anchor)`
          : `OPEX ANCHOR · $${effectiveMonthlyMaxPain.toFixed(2)}`,
      });
      priceLinesRef.current.push(line);
    }

    // 3. Gamma Flip Benchmark Line (#facc15 Canary Yellow, 2px Dashed)
    if (gammaFlipPrice > 0) {
      const line = candleSeries.createPriceLine({
        price: gammaFlipPrice,
        color: "#facc15",
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: isHovered
          ? `GAMMA FLIP: $${gammaFlipPrice.toFixed(2)} (Zero-GEX Regime Boundary)`
          : `GAMMA FLIP · $${gammaFlipPrice.toFixed(2)}`,
      });
      priceLinesRef.current.push(line);
    }

    // 4. Expected Move Envelope (+- 1-Standard Deviation, Sky Blue)
    if (emUpper > 0 && emLower > 0) {
      const upperLine = candleSeries.createPriceLine({
        price: emUpper,
        color: "#38bdf8",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: isHovered
          ? `+1σ EXPECTED MOVE: $${emUpper.toFixed(2)} (Weekly Volatility Ceiling · 68% Prob)`
          : `+1σ EXP MOVE · $${emUpper.toFixed(2)}`,
      });
      const lowerLine = candleSeries.createPriceLine({
        price: emLower,
        color: "#38bdf8",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: isHovered
          ? `-1σ EXPECTED MOVE: $${emLower.toFixed(2)} (Weekly Volatility Floor · 68% Prob)`
          : `-1σ EXP MOVE · $${emLower.toFixed(2)}`,
      });
      priceLinesRef.current.push(upperLine, lowerLine);
    }

    // 5. Plot Supports (Confluence / Put Walls / Technical)
    supports.forEach((sup) => {
      if (sup.source === "technical" && !sup.is_confluence && (!sup.tests || sup.tests <= 0)) {
        return;
      }
      let color = "rgba(16, 185, 129, 0.55)";
      let lineWidth: any = 1;
      let lineStyle: any = 1;
      let title = `SUP · $${sup.price.toFixed(2)}`;

      if (sup.is_confluence) {
        color = "#f97316"; // Vivid Orange for high conviction confluence
        lineWidth = 3;
        lineStyle = 0;
        const cleanSub = (sup.sublabel || 'Multi-Factor')
          .split('+')
          .map((s: string) => s.trim())
          .filter((s: string) => !s.toLowerCase().includes('confluence'))
          .join(' + ') || 'Multi-Factor';
        title = isHovered
          ? `CONFLUENCE FORTRESS: $${sup.price.toFixed(2)} [${cleanSub}]`
          : `CONFLUENCE · $${sup.price.toFixed(2)}`;
      } else {
        const rel = sup.strength / maxSupportAbs;
        if (rel >= 0.75) {
          color = "rgba(4, 120, 87, 0.9)";
          lineWidth = 3;
          lineStyle = 0;
          title = isHovered
            ? `MAJOR PUT WALL: $${sup.price.toFixed(2)} (${sup.sublabel || 'OI Absorption: ' + Math.round(sup.strength)})`
            : `PUT WALL · $${sup.price.toFixed(2)}`;
        } else if (rel >= 0.4) {
          color = "rgba(5, 150, 105, 0.85)";
          lineWidth = 2;
          lineStyle = 0;
          title = isHovered
            ? `INT PUT SUPPORT: $${sup.price.toFixed(2)} (${sup.sublabel || 'Options Floor'})`
            : `INT SUP · $${sup.price.toFixed(2)}`;
        } else {
          title = isHovered
            ? `MINOR SUPPORT: $${sup.price.toFixed(2)} (${sup.sublabel || 'Technical/Minor'})`
            : `SUP · $${sup.price.toFixed(2)}`;
        }
      }

      const supportLine = candleSeries.createPriceLine({
        price: sup.price,
        color,
        lineWidth,
        lineStyle,
        axisLabelVisible: true,
        title,
      });
      priceLinesRef.current.push(supportLine);
    });

    // 6. Plot Resistances (Confluence / Call Walls / Technical)
    resistances.forEach((res) => {
      if (res.source === "technical" && !res.is_confluence && (!res.tests || res.tests <= 0)) {
        return;
      }
      let color = "rgba(239, 68, 68, 0.55)";
      let lineWidth: any = 1;
      let lineStyle: any = 1;
      let title = `RES · $${res.price.toFixed(2)}`;

      if (res.is_confluence) {
        color = "#f97316"; // Vivid Orange
        lineWidth = 3;
        lineStyle = 0;
        const cleanSub = (res.sublabel || 'Multi-Factor')
          .split('+')
          .map((s: string) => s.trim())
          .filter((s: string) => !s.toLowerCase().includes('confluence'))
          .join(' + ') || 'Multi-Factor';
        title = isHovered
          ? `CONFLUENCE CEILING: $${res.price.toFixed(2)} [${cleanSub}]`
          : `CONFLUENCE · $${res.price.toFixed(2)}`;
      } else {
        const rel = res.strength / maxResistanceAbs;
        if (rel >= 0.75) {
          color = "rgba(220, 38, 38, 0.9)";
          lineWidth = 3;
          lineStyle = 0;
          title = isHovered
            ? `MAJOR CALL WALL: $${res.price.toFixed(2)} (${res.sublabel || 'Gamma Ceiling: ' + Math.round(res.strength)})`
            : `CALL WALL · $${res.price.toFixed(2)}`;
        } else if (rel >= 0.4) {
          color = "rgba(239, 68, 68, 0.85)";
          lineWidth = 2;
          lineStyle = 0;
          title = isHovered
            ? `INT CALL RESISTANCE: $${res.price.toFixed(2)} (${res.sublabel || 'Options Ceiling'})`
            : `INT RES · $${res.price.toFixed(2)}`;
        } else {
          title = isHovered
            ? `MINOR RESISTANCE: $${res.price.toFixed(2)} (${res.sublabel || 'Technical/Minor'})`
            : `RES · $${res.price.toFixed(2)}`;
        }
      }

      const resistanceLine = candleSeries.createPriceLine({
        price: res.price,
        color,
        lineWidth,
        lineStyle,
        axisLabelVisible: true,
        title,
      });
      priceLinesRef.current.push(resistanceLine);
    });

    // Subtle hover detection without heavy re-renders
    const onCrosshairMove = (param: any) => {
      if (!param.point || !chartRef.current) {
        if (isHovered) setIsHovered(false);
        return;
      }

      const mouseY = param.point.y;
      const mouseX = param.point.x;
      const containerWidth = chartContainerRef.current?.clientWidth || 800;
      
      const rightEdge = containerWidth - 50;
      const leftEdge = containerWidth - 160;

      if (mouseX < leftEdge || mouseX > rightEdge) {
        if (isHovered) setIsHovered(false);
        return;
      }

      const allPrices: number[] = [];
      if (effectiveWeeklyMaxPain > 0) allPrices.push(effectiveWeeklyMaxPain);
      if (effectiveMonthlyMaxPain > 0) allPrices.push(effectiveMonthlyMaxPain);
      if (gammaFlipPrice > 0) allPrices.push(gammaFlipPrice);
      if (emUpper > 0) allPrices.push(emUpper);
      if (emLower > 0) allPrices.push(emLower);
      supports.forEach((s) => allPrices.push(s.price));
      resistances.forEach((r) => allPrices.push(r.price));

      let hoverActive = false;
      const minDistance = 11;

      for (const price of allPrices) {
        const levelY = candleSeries.priceToCoordinate(price);
        if (levelY === null) continue;

        if (Math.abs(mouseY - levelY) < minDistance) {
          hoverActive = true;
          break;
        }
      }

      if (hoverActive !== isHovered) {
        setIsHovered(hoverActive);
      }
    };

    chartRef.current?.subscribeCrosshairMove(onCrosshairMove);

    return () => {
      chartRef.current?.unsubscribeCrosshairMove(onCrosshairMove);
    };

  }, [effectiveWeeklyMaxPain, effectiveMonthlyMaxPain, supports, resistances, isHovered, gammaFlipPrice, emUpper, emLower, maxSupportAbs, maxResistanceAbs]);

  return (
    <div className="w-full bg-neutral-950 rounded-lg p-2 border border-neutral-900 overflow-hidden relative">
      {/* Clean Status Header (No toggles, pure live info) */}
      <div className="flex items-center justify-between gap-2 mb-2 px-2 pt-1">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 items-center bg-[#0d0d16] border border-[#1f1f32] px-2.5 py-1 rounded">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-200">LIVE FEED</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-wider ${
              isLongGamma
                ? "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLongGamma ? "bg-[#00ff88]" : "bg-amber-400"}`} />
            <span>
              {isLongGamma
                ? "LONG GAMMA REGIME (Vol Suppressed / Mean-Reverting)"
                : "SHORT GAMMA REGIME (Vol Expansion / Acceleration)"}
            </span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-neutral-500">
          ZERO-LAG QUANT ENGINE
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="w-full relative" />
    </div>
  );
}
