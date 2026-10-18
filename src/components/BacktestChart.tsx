"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineStyle,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";
import BacktestDomWidget, { DomRow, SinclairStats } from "./BacktestDomWidget";

interface PriceLevel {
  price: number;
  title: string;
  color: string;
}

interface BacktestChartProps {
  ticker: "SPY" | "QQQ";
  exchangeName: "AMEX" | "NASDAQ";
  chartTitle?: string;
  selectedDate: string;
  onDateChange?: (date: string) => void;
  availableDates?: string[];
  defaultTimeframe?: string;
  heightClass?: string;
  isBlindMode?: boolean;
}

type ToolMode = "cursor" | "ruler" | "long" | "short";

interface RulerDrawing {
  startLogical: number;
  startPrice: number;
  endLogical: number;
  endPrice: number;
  locked: boolean;
}

interface PositionDrawing {
  type: "long" | "short";
  startLogical: number;
  endLogical: number;
  entryPrice: number;
  tpPrice: number;
  slPrice: number;
}

const TIMEFRAMES = [
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
];

export default function BacktestChart({
  ticker,
  exchangeName,
  selectedDate,
  defaultTimeframe = "5m",
  heightClass = "h-[640px]",
  isBlindMode = false,
}: BacktestChartProps) {
  const [timeframe, setTimeframe] = useState<string>(defaultTimeframe);
  const [spotPrice, setSpotPrice] = useState<number>(0);
  const [sinclair, setSinclair] = useState<SinclairStats | undefined>(undefined);
  const [domData, setDomData] = useState<{ "0dte": DomRow[]; weekly: DomRow[] } | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  // Full day candles & step-by-step replay state (starts at 2 candles!)
  const [candlesData, setCandlesData] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(2);
  const [levelsData, setLevelsData] = useState<PriceLevel[]>([]);

  // Interactive Tools: Cursor, Ruler (Measure), Long Position, Short Position
  const [activeTool, setActiveTool] = useState<ToolMode>("cursor");
  const [ruler, setRuler] = useState<RulerDrawing | null>(null);
  const [position, setPosition] = useState<PositionDrawing | null>(null);
  const [dragPart, setDragPart] = useState<null | "tp" | "sl" | "entry" | "rightEdge">(null);

  // Lot Size & Contract Multiplier: 0.10 lot for SPY, 0.05 lot for QQQ
  const [lotSize, setLotSize] = useState<number>(ticker === "SPY" ? 0.10 : 0.05);
  const [contractMultiplier, setContractMultiplier] = useState<number>(100);

  useEffect(() => {
    setLotSize(ticker === "SPY" ? 0.10 : 0.05);
  }, [ticker]);

  // Force re-render of SVG/HTML overlay when chart pans/zooms
  const [, setOverlayTick] = useState<number>(0);
  const triggerOverlayUpdate = useCallback(() => {
    setOverlayTick((t) => t + 1);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<any[]>([]);
  const isInitialLoadRef = useRef<boolean>(true);

  // Apply sliced candles and option levels to chart
  const renderChartData = useCallback(
    (allCandles: any[], count: number, levels: PriceLevel[], resetViewport: boolean) => {
      if (!seriesRef.current || !chartRef.current || allCandles.length === 0) return;

      try {
        const sliced = allCandles.slice(0, Math.max(1, Math.min(count, allCandles.length)));
        seriesRef.current.setData(sliced as any);

        // Clear old price lines
        priceLinesRef.current.forEach((pl) => {
          try {
            seriesRef.current?.removePriceLine(pl);
          } catch {}
        });
        priceLinesRef.current = [];

        // Draw ThetaData 09:40 ET Options Levels (mask dates in titles if in blind mode)
        if (Array.isArray(levels)) {
          levels.forEach((lvl: PriceLevel) => {
            if (lvl.price > 0 && seriesRef.current) {
              let displayTitle = lvl.title;
              if (isBlindMode) {
                // Strip date text like "(09:40 Oct 16)" -> "(09:40)"
                displayTitle = displayTitle.replace(/\s*\(\d{2}:\d{2}\s+[A-Za-z]+\s+\d+\)/, " (09:40)");
                displayTitle = displayTitle.replace(/\s*\([A-Za-z]+\s+\d+\)/, "");
              }
              const pl = seriesRef.current.createPriceLine({
                price: lvl.price,
                color: lvl.color,
                lineWidth: 2,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: displayTitle,
              });
              priceLinesRef.current.push(pl);
            }
          });
        }

        if (resetViewport) {
          // Show the first 2 candles at natural width on the left with space for upcoming bars
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: -1.5,
            to: 36,
          });
        } else {
          // If the newly revealed bar is near or beyond the right edge, scroll gently
          const range = chartRef.current.timeScale().getVisibleLogicalRange();
          if (range && sliced.length - 1 > range.to - 2) {
            const span = range.to - range.from;
            chartRef.current.timeScale().setVisibleLogicalRange({
              from: sliced.length - 1 - span + 6,
              to: sliced.length - 1 + 6,
            });
          }
        }
        triggerOverlayUpdate();
      } catch (err) {
        console.error("Error rendering chart data:", err);
      }
    },
    [isBlindMode, triggerOverlayUpdate]
  );

  // Fetch backtest data for selected day
  const fetchBacktestData = useCallback(async () => {
    if (!selectedDate) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/backtest?ticker=${ticker}&timeframe=${timeframe}&date=${selectedDate}`
      );
      if (!res.ok) throw new Error("Failed to load backtest data");
      const data = await res.json();

      setSpotPrice(data.spot || 0);
      setSinclair(data.sinclair);
      setDomData(data.dom);

      const loadedCandles = Array.isArray(data.candles) ? data.candles : [];
      const loadedLevels = Array.isArray(data.levels) ? data.levels : [];

      setCandlesData(loadedCandles);
      setLevelsData(loadedLevels);

      // Start each day at the first 2 candles (09:30 and 09:35 ET)
      const initialBars = Math.min(2, loadedCandles.length || 2);
      setVisibleCount(initialBars);
      isInitialLoadRef.current = true;

      if (seriesRef.current && loadedCandles.length > 0) {
        renderChartData(loadedCandles, initialBars, loadedLevels, true);
        isInitialLoadRef.current = false;
      }
    } catch (err) {
      console.error(`Error loading backtest data for ${ticker} on ${selectedDate}:`, err);
    } finally {
      setLoading(false);
    }
  }, [ticker, timeframe, selectedDate, renderChartData]);

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "rgba(255, 255, 255, 0.25)", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "rgba(255, 255, 255, 0.25)", width: 1, style: LineStyle.Dashed },
      },
      localization: {
        locale: "en-US",
        dateFormat: "HH:mm",
        timeFormatter: (time: any) => {
          let date: Date;
          if (typeof time === "number") {
            date = new Date(time > 1e11 ? time : time * 1000);
          } else if (time && typeof time === "object" && "year" in time) {
            date = new Date(Date.UTC(time.year, time.month - 1, time.day));
          } else {
            date = new Date();
          }
          if (isBlindMode) {
            // In blind mode, show only HH:mm so the calendar date is never spoiled
            return new Intl.DateTimeFormat("en-US", {
              timeZone: "Europe/Sofia",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).format(date);
          }
          return new Intl.DateTimeFormat("en-US", {
            timeZone: "Europe/Sofia",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(date);
        },
      },
      timeScale: {
        borderColor: "#1e293b",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        tickMarkFormatter: (time: any) => {
          let date: Date;
          if (typeof time === "number") {
            date = new Date(time > 1e11 ? time : time * 1000);
          } else if (time && typeof time === "object" && "year" in time) {
            date = new Date(Date.UTC(time.year, time.month - 1, time.day));
          } else {
            date = new Date();
          }
          return new Intl.DateTimeFormat("en-US", {
            timeZone: "Europe/Sofia",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(date);
        },
      },
      rightPriceScale: {
        borderColor: "#1e293b",
        visible: true,
        autoScale: true,
      },
      autoSize: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#fbc02d",
      downColor: "#f57c00",
      borderUpColor: "#fbc02d",
      borderDownColor: "#f57c00",
      wickUpColor: "#fbc02d",
      wickDownColor: "#f57c00",
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      triggerOverlayUpdate();
    });

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
        triggerOverlayUpdate();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [isBlindMode, triggerOverlayUpdate]);

  useEffect(() => {
    fetchBacktestData();
  }, [fetchBacktestData]);

  // Update chart when visibleCount changes
  useEffect(() => {
    if (seriesRef.current && candlesData.length > 0) {
      renderChartData(candlesData, visibleCount, levelsData, isInitialLoadRef.current);
      isInitialLoadRef.current = false;
    }
  }, [candlesData, visibleCount, levelsData, renderChartData]);

  // Step controls
  const stepForward = useCallback(
    (step: number = 1) => {
      setVisibleCount((prev) => Math.min(candlesData.length, prev + step));
    },
    [candlesData.length]
  );

  const stepBackward = useCallback(() => {
    setVisibleCount((prev) => Math.max(2, prev - 1));
  }, []);

  const resetToTwo = useCallback(() => {
    isInitialLoadRef.current = true;
    setVisibleCount(Math.min(2, candlesData.length || 2));
  }, [candlesData.length]);

  const showAllCandles = useCallback(() => {
    setVisibleCount(candlesData.length);
    setTimeout(() => {
      chartRef.current?.timeScale().fitContent();
      triggerOverlayUpdate();
    }, 30);
  }, [candlesData.length, triggerOverlayUpdate]);

  // Coordinate conversion helpers
  const xToLogical = (x: number): number => {
    if (!chartRef.current) return 0;
    const l = chartRef.current.timeScale().coordinateToLogical(x);
    return l !== null ? Number(l) : Math.max(0, visibleCount - 1);
  };

  const logicalToX = (logical: number): number | null => {
    if (!chartRef.current) return null;
    const x = chartRef.current.timeScale().logicalToCoordinate(logical as any);
    return x !== null ? Number(x) : null;
  };

  const yToPrice = (y: number): number => {
    if (!seriesRef.current) return spotPrice;
    const p = seriesRef.current.coordinateToPrice(y);
    return p !== null ? Number(p) : spotPrice;
  };

  const priceToY = (price: number): number | null => {
    if (!seriesRef.current) return null;
    const y = seriesRef.current.priceToCoordinate(price);
    return y !== null ? Number(y) : null;
  };

  // Mouse handlers on chart wrapper for Ruler & Long/Short Position placement and dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartWrapperRef.current) return;
    const rect = chartWrapperRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Ignore clicks on right price axis (~65px) or bottom time axis (~28px)
    if (x > rect.width - 65 || y > rect.height - 28) return;

    const clickLogical = xToLogical(x);
    const clickPrice = yToPrice(y);

    if (activeTool === "ruler") {
      if (!ruler || ruler.locked) {
        setRuler({
          startLogical: Math.round(clickLogical),
          startPrice: clickPrice,
          endLogical: Math.round(clickLogical),
          endPrice: clickPrice,
          locked: false,
        });
      } else {
        setRuler({
          ...ruler,
          endLogical: Math.round(clickLogical),
          endPrice: clickPrice,
          locked: true,
        });
        setActiveTool("cursor");
      }
      return;
    }

    if (activeTool === "long" || activeTool === "short") {
      const isLong = activeTool === "long";
      const tpDist = clickPrice * 0.004;
      const slDist = clickPrice * 0.002;
      const startL = Math.max(0, Math.round(clickLogical));
      setPosition({
        type: activeTool,
        startLogical: startL,
        endLogical: startL + 12,
        entryPrice: Number(clickPrice.toFixed(2)),
        tpPrice: Number((isLong ? clickPrice + tpDist : clickPrice - tpDist).toFixed(2)),
        slPrice: Number((isLong ? clickPrice - slDist : clickPrice + slDist).toFixed(2)),
      });
      setActiveTool("cursor");
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartWrapperRef.current) return;
    const rect = chartWrapperRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (ruler && !ruler.locked) {
      setRuler((prev) =>
        prev
          ? {
              ...prev,
              endLogical: Math.round(xToLogical(x)),
              endPrice: yToPrice(y),
            }
          : null
      );
      return;
    }

    if (dragPart && position) {
      const newPrice = Number(yToPrice(y).toFixed(2));
      const newLogical = Math.round(xToLogical(x));

      setPosition((prev) => {
        if (!prev) return null;
        if (dragPart === "tp") {
          if (prev.type === "long") {
            return { ...prev, tpPrice: Math.max(prev.entryPrice + 0.05, newPrice) };
          } else {
            return { ...prev, tpPrice: Math.min(prev.entryPrice - 0.05, newPrice) };
          }
        }
        if (dragPart === "sl") {
          if (prev.type === "long") {
            return { ...prev, slPrice: Math.min(prev.entryPrice - 0.05, newPrice) };
          } else {
            return { ...prev, slPrice: Math.max(prev.entryPrice + 0.05, newPrice) };
          }
        }
        if (dragPart === "entry") {
          const tpDelta = prev.tpPrice - prev.entryPrice;
          const slDelta = prev.slPrice - prev.entryPrice;
          const widthL = prev.endLogical - prev.startLogical;
          const nextStart = Math.max(0, newLogical);
          return {
            ...prev,
            startLogical: nextStart,
            endLogical: nextStart + widthL,
            entryPrice: newPrice,
            tpPrice: Number((newPrice + tpDelta).toFixed(2)),
            slPrice: Number((newPrice + slDelta).toFixed(2)),
          };
        }
        if (dragPart === "rightEdge") {
          return {
            ...prev,
            endLogical: Math.max(prev.startLogical + 3, newLogical),
          };
        }
        return prev;
      });
    }
  };

  const handleMouseUp = () => {
    if (dragPart) {
      setDragPart(null);
      if (chartRef.current) {
        chartRef.current.applyOptions({ handleScroll: true, handleScale: true });
      }
    }
  };

  const startDraggingPart = (part: "tp" | "sl" | "entry" | "rightEdge") => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragPart(part);
    if (chartRef.current) {
      chartRef.current.applyOptions({ handleScroll: false, handleScale: false });
    }
  };

  const currentCandle =
    candlesData.length > 0
      ? candlesData[Math.min(visibleCount - 1, candlesData.length - 1)]
      : null;
  const currentClosePrice = currentCandle ? Number(currentCandle.close) : spotPrice;

  // Compute Ruler overlay coordinates & stats
  let rulerOverlay: React.ReactNode = null;
  if (ruler) {
    const x1 = logicalToX(ruler.startLogical);
    const x2 = logicalToX(ruler.endLogical);
    const y1 = priceToY(ruler.startPrice);
    const y2 = priceToY(ruler.endPrice);

    if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
      const diff = ruler.endPrice - ruler.startPrice;
      const pct = ruler.startPrice > 0 ? (diff / ruler.startPrice) * 100 : 0;
      const barsCount = Math.abs(ruler.endLogical - ruler.startLogical);
      const minsPerBar = timeframe === "5m" ? 5 : timeframe === "15m" ? 15 : 60;
      const totalMins = barsCount * minsPerBar;
      const isUp = diff >= 0;
      const boxBg = isUp ? "rgba(56, 189, 248, 0.18)" : "rgba(244, 63, 94, 0.18)";
      const borderColor = isUp ? "#38bdf8" : "#f43f5e";

      const left = Math.min(x1, x2);
      const width = Math.max(4, Math.abs(x2 - x1));
      const top = Math.min(y1, y2);
      const height = Math.max(2, Math.abs(y2 - y1));

      rulerOverlay = (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden font-mono">
          <div
            style={{
              position: "absolute",
              left,
              top,
              width,
              height,
              background: boxBg,
              border: `1.5px dashed ${borderColor}`,
            }}
          />
          <svg className="absolute inset-0 w-full h-full">
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={borderColor} strokeWidth="1.5" />
            <circle cx={x1} cy={y1} r="3.5" fill={borderColor} />
            <circle cx={x2} cy={y2} r="3.5" fill={borderColor} />
          </svg>
          <div
            style={{
              position: "absolute",
              left: Math.max(8, Math.min(left + width / 2 - 85, (chartWrapperRef.current?.clientWidth || 800) - 210)),
              top: y2 < y1 ? Math.max(8, top - 44) : top + height + 6,
              background: isUp ? "#0284c7" : "#e11d48",
              color: "#ffffff",
              padding: "4px 10px",
              borderRadius: "5px",
              fontSize: "11px",
              fontWeight: 900,
              boxShadow: "0 4px 14px rgba(0,0,0,0.75)",
              whiteSpace: "nowrap",
              border: "1px solid rgba(255,255,255,0.35)",
            }}
          >
            <div>
              {diff >= 0 ? "+" : ""}
              {diff.toFixed(2)} ({pct >= 0 ? "+" : ""}
              {pct.toFixed(2)}%)
            </div>
            <div className="text-[10px] font-normal opacity-90">
              {barsCount} bars · {totalMins} mins (${ruler.startPrice.toFixed(2)} → ${ruler.endPrice.toFixed(2)})
            </div>
          </div>
        </div>
      );
    }
  }

  // Compute TradingView Long / Short Position Overlay
  let positionOverlay: React.ReactNode = null;
  if (position) {
    const x1 = logicalToX(position.startLogical);
    const x2 = logicalToX(position.endLogical);
    const yEntry = priceToY(position.entryPrice);
    const yTp = priceToY(position.tpPrice);
    const ySl = priceToY(position.slPrice);

    if (x1 !== null && x2 !== null && yEntry !== null && yTp !== null && ySl !== null) {
      const left = Math.min(x1, x2);
      const width = Math.max(70, Math.abs(x2 - x1));
      const units = lotSize * contractMultiplier;

      const isLong = position.type === "long";
      const tpDiff = isLong
        ? position.tpPrice - position.entryPrice
        : position.entryPrice - position.tpPrice;
      const slDiff = isLong
        ? position.entryPrice - position.slPrice
        : position.slPrice - position.entryPrice;

      const tpPct = position.entryPrice > 0 ? (tpDiff / position.entryPrice) * 100 : 0;
      const slPct = position.entryPrice > 0 ? (slDiff / position.entryPrice) * 100 : 0;

      const tpDollars = tpDiff * units;
      const slDollars = slDiff * units;
      const rrRatio = slDiff > 0 ? tpDiff / slDiff : 0;

      const liveDiff = isLong
        ? currentClosePrice - position.entryPrice
        : position.entryPrice - currentClosePrice;
      const livePct = position.entryPrice > 0 ? (liveDiff / position.entryPrice) * 100 : 0;
      const liveDollars = liveDiff * units;

      const tpTop = Math.min(yEntry, yTp);
      const tpHeight = Math.max(2, Math.abs(yEntry - yTp));
      const slTop = Math.min(yEntry, ySl);
      const slHeight = Math.max(2, Math.abs(yEntry - ySl));

      positionOverlay = (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden font-mono">
          {/* Take Profit Zone (Green) */}
          <div
            style={{
              position: "absolute",
              left,
              top: tpTop,
              width,
              height: tpHeight,
              background: "rgba(16, 185, 129, 0.24)",
              borderLeft: "2px solid #10b981",
              borderRight: "1px dashed rgba(16, 185, 129, 0.6)",
            }}
          />

          {/* Stop Loss Zone (Red) */}
          <div
            style={{
              position: "absolute",
              left,
              top: slTop,
              width,
              height: slHeight,
              background: "rgba(239, 68, 68, 0.24)",
              borderLeft: "2px solid #ef4444",
              borderRight: "1px dashed rgba(239, 68, 68, 0.6)",
            }}
          />

          {/* Draggable TP Line & Info Pill */}
          <div
            onMouseDown={startDraggingPart("tp")}
            title="Drag to adjust Take Profit (TP)"
            className="pointer-events-auto cursor-ns-resize group"
            style={{
              position: "absolute",
              left,
              top: yTp - 5,
              width,
              height: 10,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div className="w-full h-[2px] bg-[#10b981] group-hover:h-[3px] shadow-[0_0_6px_#10b981]" />
            <div
              style={{
                position: "absolute",
                left: 6,
                top: isLong ? -24 : 8,
                background: "#065f46",
                border: "1px solid #10b981",
                color: "#ecfdf5",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "10.5px",
                fontWeight: 800,
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(0,0,0,0.8)",
              }}
            >
              TP: ${position.tpPrice.toFixed(2)} | +{tpPct.toFixed(2)}% (+${tpDiff.toFixed(2)}) | Profit: +${tpDollars.toFixed(2)}
            </div>
          </div>

          {/* Draggable Entry Line & Center Info Pill */}
          <div
            onMouseDown={startDraggingPart("entry")}
            title="Drag to move Entry position"
            className="pointer-events-auto cursor-move group"
            style={{
              position: "absolute",
              left,
              top: yEntry - 5,
              width,
              height: 10,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div className="w-full h-[2px] bg-[#e2e8f0] group-hover:bg-[#38bdf8]" />
            <div
              style={{
                position: "absolute",
                left: 6,
                top: -11,
                background: "#0f172a",
                border: "1px solid #38bdf8",
                color: "#f8fafc",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "10.5px",
                fontWeight: 900,
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(0,0,0,0.85)",
              }}
            >
              <span className={isLong ? "text-[#10b981]" : "text-[#f43f5e]"}>
                {isLong ? "▲ LONG" : "▼ SHORT"}
              </span>{" "}
              {lotSize.toFixed(2)} lots ({units.toFixed(0)} units) @ ${position.entryPrice.toFixed(2)} | R:R 1:{rrRatio.toFixed(2)} |{" "}
              <span className={liveDollars >= 0 ? "text-[#10b981]" : "text-[#f43f5e]"}>
                Live: {liveDollars >= 0 ? "+" : ""}${liveDollars.toFixed(2)} ({livePct >= 0 ? "+" : ""}
                {livePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Draggable SL Line & Info Pill */}
          <div
            onMouseDown={startDraggingPart("sl")}
            title="Drag to adjust Stop Loss (SL)"
            className="pointer-events-auto cursor-ns-resize group"
            style={{
              position: "absolute",
              left,
              top: ySl - 5,
              width,
              height: 10,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div className="w-full h-[2px] bg-[#ef4444] group-hover:h-[3px] shadow-[0_0_6px_#ef4444]" />
            <div
              style={{
                position: "absolute",
                left: 6,
                top: isLong ? 8 : -24,
                background: "#7f1d1d",
                border: "1px solid #ef4444",
                color: "#fef2f2",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "10.5px",
                fontWeight: 800,
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(0,0,0,0.8)",
              }}
            >
              SL: ${position.slPrice.toFixed(2)} | -{slPct.toFixed(2)}% (-${slDiff.toFixed(2)}) | Loss: -${slDollars.toFixed(2)}
            </div>
          </div>

          {/* Right Edge Width Handle */}
          <div
            onMouseDown={startDraggingPart("rightEdge")}
            title="Drag to resize position width"
            className="pointer-events-auto cursor-ew-resize"
            style={{
              position: "absolute",
              left: left + width - 5,
              top: Math.min(tpTop, slTop),
              width: 10,
              height: Math.max(tpTop + tpHeight, slTop + slHeight) - Math.min(tpTop, slTop),
            }}
          />
        </div>
      );
    }
  }

  return (
    <div className={`relative w-full ${heightClass} bg-black border border-[#1e293b] rounded-lg overflow-hidden flex flex-col shadow-2xl`}>
      {/* Replay & TradingView Drawing Tools Toolbar */}
      <div className="h-10 px-3 bg-[#070a12] border-b border-[#1e293b] flex items-center justify-between text-xs font-mono select-none flex-shrink-0 z-30">
        {/* Left: Candle-by-Candle Replay Controls (No 78/78 box) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-neutral-400 uppercase mr-1">CANDLES:</span>

          <button
            onClick={resetToTwo}
            title="Reset to first 2 candles (09:30 & 09:35 ET)"
            className="px-2 py-1 rounded bg-[#0f172a] hover:bg-[#1e293b] text-neutral-300 border border-[#334155] text-[10.5px] font-bold transition-colors"
          >
            ⏮ First 2
          </button>

          <button
            onClick={stepBackward}
            disabled={visibleCount <= 2}
            title="Step back 1 candle"
            className={`px-2 py-1 rounded border text-[10.5px] font-bold transition-colors ${
              visibleCount > 2
                ? "bg-[#0f172a] hover:bg-[#1e293b] text-neutral-200 border-[#334155]"
                : "bg-black/30 text-neutral-600 border-[#1e293b] cursor-not-allowed"
            }`}
          >
            ◀ -1
          </button>

          <button
            onClick={() => stepForward(1)}
            disabled={visibleCount >= candlesData.length}
            title="Step forward 1 candle"
            className={`px-3 py-1 rounded border text-[11px] font-black transition-all ${
              visibleCount < candlesData.length
                ? "bg-[#00ff88] hover:bg-[#10b981] text-black border-[#00ff88] shadow-[0_0_10px_rgba(0,255,136,0.35)] active:scale-95"
                : "bg-black/30 text-neutral-600 border-[#1e293b] cursor-not-allowed"
            }`}
          >
            ▶ +1 Bar
          </button>

          <button
            onClick={() => stepForward(5)}
            disabled={visibleCount >= candlesData.length}
            title="Step forward 5 candles"
            className={`px-2 py-1 rounded border text-[10.5px] font-bold transition-colors ${
              visibleCount < candlesData.length
                ? "bg-[#0f172a] hover:bg-[#1e293b] text-neutral-200 border-[#334155]"
                : "bg-black/30 text-neutral-600 border-[#1e293b] cursor-not-allowed"
            }`}
          >
            +5 ⏩
          </button>

          <button
            onClick={showAllCandles}
            disabled={visibleCount >= candlesData.length}
            title="Reveal all candles for the session"
            className="px-2 py-1 rounded bg-[#0f172a] hover:bg-[#1e293b] text-neutral-300 border border-[#334155] text-[10.5px] font-bold transition-colors"
          >
            All
          </button>
        </div>

        {/* Right: Timeframe, Measure Tool, Long/Short Position Tools & Lot Calculator */}
        <div className="flex items-center gap-2">
          {/* Timeframe Selector (Moved here from deleted row) */}
          <div className="flex items-center gap-1 bg-[#0b0f19] p-0.5 rounded border border-[#1e293b]">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  timeframe === tf.value
                    ? "bg-[#f59e0b] text-black shadow-sm font-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-[1px] bg-[#1e293b]" />

          <button
            onClick={() => setActiveTool(activeTool === "ruler" ? "cursor" : "ruler")}
            className={`px-2.5 py-1 rounded border text-[10.5px] font-bold transition-all ${
              activeTool === "ruler"
                ? "bg-[#38bdf8] text-black border-[#38bdf8] font-black shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                : "bg-[#0f172a] hover:bg-[#1e293b] text-neutral-200 border-[#334155]"
            }`}
            title="Click 2 points on chart to measure percentage and price distance"
          >
            📏 Measure (%)
          </button>

          <button
            onClick={() => setActiveTool(activeTool === "long" ? "cursor" : "long")}
            className={`px-2.5 py-1 rounded border text-[10.5px] font-bold transition-all ${
              activeTool === "long"
                ? "bg-[#10b981] text-black border-[#10b981] font-black shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : "bg-[#064e3b]/60 hover:bg-[#065f46] text-[#34d399] border-[#10b981]/50"
            }`}
            title="Click on chart to place a Long Position with TP & SL"
          >
            📈 Long
          </button>

          <button
            onClick={() => setActiveTool(activeTool === "short" ? "cursor" : "short")}
            className={`px-2.5 py-1 rounded border text-[10.5px] font-bold transition-all ${
              activeTool === "short"
                ? "bg-[#ef4444] text-white border-[#ef4444] font-black shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                : "bg-[#7f1d1d]/60 hover:bg-[#991b1b] text-[#fca5a5] border-[#ef4444]/50"
            }`}
            title="Click on chart to place a Short Position with TP & SL"
          >
            📉 Short
          </button>

          {/* Lot Size & Multiplier Controls */}
          <div className="flex items-center gap-1 bg-[#0f172a] px-2 py-0.5 rounded border border-[#334155]">
            <span className="text-[10px] text-neutral-400">Lot:</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={lotSize}
              onChange={(e) => setLotSize(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
              className="w-12 bg-black text-[#facc15] font-bold text-[11px] px-1 py-0.5 rounded border border-[#334155] text-center focus:outline-none"
            />
            <select
              value={contractMultiplier}
              onChange={(e) => setContractMultiplier(Number(e.target.value))}
              title="Contract unit multiplier (100 = standard Stock/ETF CFD lot)"
              className="bg-black text-neutral-300 text-[10px] px-1 py-0.5 rounded border border-[#334155] focus:outline-none"
            >
              <option value={100}>1 lot = 100</option>
              <option value={1000}>1 lot = 1000</option>
              <option value={10}>1 lot = 10</option>
              <option value={1}>1 lot = 1</option>
            </select>
          </div>

          {(ruler || position) && (
            <button
              onClick={() => {
                setRuler(null);
                setPosition(null);
                setActiveTool("cursor");
              }}
              className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-500/40 text-[10.5px] font-bold transition-colors"
              title="Clear active ruler and positions"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Helper banner when an interactive tool is armed */}
      {activeTool !== "cursor" && (
        <div className="bg-[#0284c7]/90 text-white text-[11px] font-mono font-bold px-3 py-1 text-center z-30">
          {activeTool === "ruler" &&
            (ruler && !ruler.locked
              ? "📏 Move mouse and click second point to lock measurement..."
              : "📏 Click start point on chart to measure...")}
          {activeTool === "long" &&
            `📈 Click on chart to place LONG position (${lotSize.toFixed(2)} lots ${ticker})...`}
          {activeTool === "short" &&
            `📉 Click on chart to place SHORT position (${lotSize.toFixed(2)} lots ${ticker})...`}
        </div>
      )}

      {/* Main Body: 2-Column Side-by-Side Flex Layout */}
      <div className="relative flex-1 w-full flex flex-row min-h-0 bg-black overflow-hidden">
        {/* Left Column: Dedicated Fixed Space for Options DOM Only */}
        <div className="w-[316px] min-w-[316px] max-w-[316px] h-full bg-[#080a14] border-r border-[#1e293b] p-2 flex flex-col z-10 overflow-hidden">
          <BacktestDomWidget
            ticker={ticker}
            selectedDate={selectedDate}
            sinclair={sinclair}
            domData={domData}
            spot={spotPrice}
          />
        </div>

        {/* Right Column: Candlestick Chart Canvas + Interactive Overlays */}
        <div
          ref={chartWrapperRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`relative flex-1 h-full min-w-0 bg-black ${
            activeTool !== "cursor" ? "cursor-crosshair" : ""
          }`}
        >
          <div ref={containerRef} className="w-full h-full" />

          {/* Ruler Overlay */}
          {rulerOverlay}

          {/* Long / Short Position Overlay */}
          {positionOverlay}

          {/* Loading Spinner */}
          {loading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none z-30 font-mono text-xs text-neutral-400">
              <span className="animate-pulse">
                Loading {ticker} session...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
