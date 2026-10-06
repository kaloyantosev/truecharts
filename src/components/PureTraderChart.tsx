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
import OptionsDomWidget, { DomRow, SinclairStats } from "./OptionsDomWidget";

interface PriceLevel {
  price: number;
  title: string;
  color: string;
}

interface PureTraderChartProps {
  ticker: "SPY" | "QQQ";
  exchangeName: "AMEX" | "NASDAQ";
  chartTitle: string;
  defaultTimeframe?: string;
}

const TIMEFRAMES = [
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "Daily", value: "1D" },
];

export default function PureTraderChart({
  ticker,
  exchangeName,
  chartTitle,
  defaultTimeframe = "15m",
}: PureTraderChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<any[]>([]);

  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [spotPrice, setSpotPrice] = useState<number>(0);
  const [sinclair, setSinclair] = useState<SinclairStats | undefined>();
  const [domData, setDomData] = useState<{ "0dte": DomRow[]; weekly: DomRow[] } | undefined>();
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  // Fetch live market data (Candles, Options Model Levels, DOM, Sinclair)
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/trader-panel?ticker=${ticker}&timeframe=${timeframe}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.spot) setSpotPrice(data.spot);
      if (data.sinclair) setSinclair(data.sinclair);
      if (data.dom) setDomData(data.dom);
      setLastRefreshed(new Date().toLocaleTimeString());

      // Update Chart Series
      if (seriesRef.current && Array.isArray(data.candles) && data.candles.length > 0) {
        seriesRef.current.setData(data.candles);

        // Clear previous price lines
        priceLinesRef.current.forEach((pl) => {
          try {
            seriesRef.current?.removePriceLine(pl);
          } catch (e) {}
        });
        priceLinesRef.current = [];

        // Draw Options Model Lines
        const levels: PriceLevel[] = [];
        if (data.modelLevels) {
          if (data.modelLevels.gammaFlip) levels.push(data.modelLevels.gammaFlip);
          if (data.modelLevels.confluencePut) levels.push(data.modelLevels.confluencePut);
          if (data.modelLevels.confluenceCall) levels.push(data.modelLevels.confluenceCall);
          if (data.modelLevels.expMoveLower) levels.push(data.modelLevels.expMoveLower);
          if (data.modelLevels.expMoveUpper) levels.push(data.modelLevels.expMoveUpper);
        }

        levels.forEach((lvl) => {
          if (lvl.price > 0 && seriesRef.current) {
            const pl = seriesRef.current.createPriceLine({
              price: lvl.price,
              color: lvl.color,
              lineWidth: 2,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: lvl.title,
            });
            priceLinesRef.current.push(pl);
          }
        });
      }
    } catch (err) {
      console.error(`Error loading trader data for ${ticker}:`, err);
    } finally {
      setLoading(false);
    }
  }, [ticker, timeframe]);

  // Initial Chart Initialization
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Create Lightweight Chart with pure black background and hidden grids
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
        vertLine: { color: "rgba(255, 255, 255, 0.2)", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "rgba(255, 255, 255, 0.2)", width: 1, style: LineStyle.Dashed },
      },
      timeScale: {
        borderColor: "#1e293b",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#1e293b",
        autoScale: true,
      },
      autoSize: true,
    });

    // 2. Add Candlestick Series matching user screenshot (Golden Amber candles on Black)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#f59e0b",
      downColor: "#f59e0b",
      borderUpColor: "#f59e0b",
      borderDownColor: "#f59e0b",
      wickUpColor: "#f59e0b",
      wickDownColor: "#f59e0b",
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;

    // Handle Window Resize
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Fetch data on timeframe change and mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60 seconds (1 minute)
  useEffect(() => {
    const timer = setInterval(() => {
      fetchData();
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchData]);

  return (
    <div className="relative w-full h-[460px] bg-black border border-[#1e293b] rounded-lg overflow-hidden flex flex-col shadow-2xl">
      {/* Top Header Strip: Symbol, Timeframes, Live Badge */}
      <div className="h-9 px-3 bg-[#05070e] border-b border-[#1e293b] flex items-center justify-between text-xs font-mono select-none z-20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="font-bold text-white tracking-wide">{chartTitle}</span>
          <span className="text-neutral-500">·</span>
          <span className="text-neutral-400 font-bold">{timeframe}</span>
          <span className="text-neutral-500">·</span>
          <span className="text-[#38bdf8] font-bold">{exchangeName}</span>
          {spotPrice > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-[#0f172a] border border-[#334155] rounded text-white font-black text-[11px]">
              ${spotPrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Timeframe Selectors */}
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
      </div>

      {/* Chart Canvas & Options DOM Overlay */}
      <div className="relative flex-1 w-full h-full bg-black">
        {/* Floating Options DOM from Injector */}
        <OptionsDomWidget
          ticker={ticker}
          sinclair={sinclair}
          domData={domData}
          spot={spotPrice}
        />

        {/* Pure Black Lightweight Chart Container */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none z-10 font-mono text-xs text-neutral-400">
            <span className="animate-pulse">Loading {ticker} market candles...</span>
          </div>
        )}
      </div>
    </div>
  );
}
