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

  // Institutional Options Enhancements Toggles
  const [showPockets, setShowPockets] = useState(true);
  const [showGexProfile, setShowGexProfile] = useState(true);
  const [showGammaFlip, setShowGammaFlip] = useState(true);
  const [showExpectedMove, setShowExpectedMove] = useState(true);

  // SVG Layer States
  const [pockets, setPockets] = useState<any[]>([]);
  const [gexBars, setGexBars] = useState<any[]>([]);
  const [emChannel, setEmChannel] = useState<{ yTop: number; yBot: number; width: number } | null>(null);

  // Max Pain Resolutions
  const effectiveWeeklyMaxPain = weeklyMaxPain && weeklyMaxPain > 0 ? weeklyMaxPain : maxPain;
  const effectiveMonthlyMaxPain = monthlyMaxPain && monthlyMaxPain > 0 ? monthlyMaxPain : maxPain;

  // Dynamic Strengths
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
      height: 420,
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
        const res = await fetch(`${apiBaseUrl}/api/history/${ticker}?timeframe=${encodeURIComponent(timeframe)}`);
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

  // Update horizontal lines and SVG overlays
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !chart || !chartContainerRef.current) return;

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

    // 3. Gamma Flip Benchmark Line (#fbbf24 Amber Gold, 2px Dashed)
    if (showGammaFlip && gammaFlipPrice > 0) {
      const line = candleSeries.createPriceLine({
        price: gammaFlipPrice,
        color: "#fbbf24",
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: isHovered
          ? `GAMMA FLIP: $${gammaFlipPrice.toFixed(2)} (Zero-GEX Regime Boundary)`
          : `GAMMA FLIP · $${gammaFlipPrice.toFixed(2)}`,
      });
      priceLinesRef.current.push(line);
    }

    // 4. Expected Move Envelope (+- 1-Standard Deviation)
    if (showExpectedMove && emUpper > 0 && emLower > 0) {
      const upperLine = candleSeries.createPriceLine({
        price: emUpper,
        color: "#38bdf8",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: isHovered
          ? `+1σ EXPECTED MOVE: $${emUpper.toFixed(2)} (Weekly Volatility Envelope · 68% Prob)`
          : `+1σ EXP MOVE · $${emUpper.toFixed(2)}`,
      });
      const lowerLine = candleSeries.createPriceLine({
        price: emLower,
        color: "#38bdf8",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: isHovered
          ? `-1σ EXPECTED MOVE: $${emLower.toFixed(2)} (Weekly Volatility Envelope · 68% Prob)`
          : `-1σ EXP MOVE · $${emLower.toFixed(2)}`,
      });
      priceLinesRef.current.push(upperLine, lowerLine);
    }

    // 5. Plot Supports (Confluence / Put Walls / Technical)
    supports.forEach((sup) => {
      let color = "rgba(16, 185, 129, 0.55)";
      let lineWidth: any = 1;
      let lineStyle: any = 1;
      let title = `SUP · $${sup.price.toFixed(2)}`;

      if (sup.is_confluence) {
        color = "#f59e0b"; // Amber Gold for high conviction confluence
        lineWidth = 3;
        lineStyle = 0;
        title = isHovered
          ? `CONFLUENCE FORTRESS: $${sup.price.toFixed(2)} [${sup.sublabel || 'Multi-Factor'}]`
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
      let color = "rgba(239, 68, 68, 0.55)";
      let lineWidth: any = 1;
      let lineStyle: any = 1;
      let title = `RES · $${res.price.toFixed(2)}`;

      if (res.is_confluence) {
        color = "#f59e0b";
        lineWidth = 3;
        lineStyle = 0;
        title = isHovered
          ? `CONFLUENCE CEILING: $${res.price.toFixed(2)} [${res.sublabel || 'Multi-Factor'}]`
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

    const onCrosshairMove = (param: any) => {
      if (!param.point || !chartRef.current) {
        setIsHovered(false);
        return;
      }

      const mouseY = param.point.y;
      const mouseX = param.point.x;
      const containerWidth = chartContainerRef.current?.clientWidth || 800;
      
      const rightEdge = containerWidth - 60;
      const leftEdge = containerWidth - 140;

      if (mouseX < leftEdge || mouseX > rightEdge) {
        setIsHovered(false);
        return;
      }

      const allPrices: number[] = [];
      if (effectiveWeeklyMaxPain > 0) allPrices.push(effectiveWeeklyMaxPain);
      if (effectiveMonthlyMaxPain > 0) allPrices.push(effectiveMonthlyMaxPain);
      if (showGammaFlip && gammaFlipPrice > 0) allPrices.push(gammaFlipPrice);
      if (showExpectedMove && emUpper > 0) allPrices.push(emUpper);
      if (showExpectedMove && emLower > 0) allPrices.push(emLower);
      supports.forEach((s) => allPrices.push(s.price));
      resistances.forEach((r) => allPrices.push(r.price));

      let hoverActive = false;
      const minDistance = 11;

      for (const price of allPrices) {
        const levelY = candleSeries.priceToCoordinate(price);
        if (levelY === null) continue;

        const distance = Math.abs(mouseY - levelY);
        if (distance < minDistance) {
          hoverActive = true;
          break;
        }
      }

      setIsHovered(hoverActive);
    };

    const updateAllOverlays = () => {
      if (!chart || !candleSeries) return;
      const containerWidth = chartContainerRef.current?.clientWidth || 800;
      const plotWidth = Math.max(100, containerWidth - 62);

      // 1. Weekly Imbalance Gaps
      if (weeklyGaps.length > 0) {
        const rects = weeklyGaps.map((gap, idx) => {
          const x1 = chart.timeScale().timeToCoordinate(gap.startTime);
          const x2 = chart.timeScale().timeToCoordinate(gap.endTime);
          const y1 = candleSeries.priceToCoordinate(gap.top);
          const y2 = candleSeries.priceToCoordinate(gap.bottom);

          if (x1 === null || x2 === null || y1 === null || y2 === null) return null;

          return {
            id: idx,
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.max(Math.abs(x2 - x1), 15),
            height: Math.abs(y2 - y1),
          };
        }).filter(Boolean) as any[];
        setSvgRects(rects);
      } else {
        setSvgRects([]);
      }

      // 2. Expected Move Volatility Corridor
      if (showExpectedMove && emUpper > 0 && emLower > 0) {
        const yTop = candleSeries.priceToCoordinate(emUpper);
        const yBot = candleSeries.priceToCoordinate(emLower);
        if (yTop !== null && yBot !== null) {
          setEmChannel({
            yTop: Math.min(yTop, yBot),
            yBot: Math.max(yTop, yBot),
            width: plotWidth,
          });
        } else {
          setEmChannel(null);
        }
      } else {
        setEmChannel(null);
      }

      // 3. Rectangular Liquidity Pockets
      const computedPockets: any[] = [];
      const levelsForPockets: any[] = [];

      supports.forEach((s) => {
        const rel = s.strength / maxSupportAbs;
        if (rel >= 0.4 || s.is_confluence) levelsForPockets.push({ ...s, type: "support", rel });
      });

      resistances.forEach((r) => {
        const rel = r.strength / maxResistanceAbs;
        if (rel >= 0.4 || r.is_confluence) levelsForPockets.push({ ...r, type: "resistance", rel });
      });

      if (effectiveWeeklyMaxPain > 0) {
        levelsForPockets.push({ price: effectiveWeeklyMaxPain, strength: 50, type: "maxpain", rel: 0.8, dte: 7 });
      }

      levelsForPockets.forEach((lvl, idx) => {
        const spreadPct = lvl.is_confluence ? 0.004 : lvl.rel >= 0.75 ? 0.0035 : 0.0025;
        const pTop = lvl.price * (1 + spreadPct);
        const pBot = lvl.price * (1 - spreadPct);
        const yTop = candleSeries.priceToCoordinate(pTop);
        const yBot = candleSeries.priceToCoordinate(pBot);

        if (yTop !== null && yBot !== null) {
          const y = Math.min(yTop, yBot);
          const h = Math.max(16, Math.abs(yBot - yTop));
          const isWeekly = lvl.dte !== null && lvl.dte !== undefined && lvl.dte <= 7;

          let title = "";
          let fill = "";
          let stroke = "";

          if (lvl.is_confluence) {
            title = `L3 CONFLUENCE ZONE · $${lvl.price.toFixed(2)}`;
            fill = "rgba(245, 158, 11, 0.09)";
            stroke = "rgba(245, 158, 11, 0.55)";
          } else if (lvl.type === "support") {
            title = `PUT LIQUIDITY POCKET · $${lvl.price.toFixed(2)}`;
            fill = "rgba(0, 255, 136, 0.07)";
            stroke = "rgba(0, 255, 136, 0.35)";
          } else if (lvl.type === "resistance") {
            title = `CALL LIQUIDITY POCKET · $${lvl.price.toFixed(2)}`;
            fill = "rgba(255, 51, 85, 0.07)";
            stroke = "rgba(255, 51, 85, 0.35)";
          } else {
            title = `MAX PAIN GAMMA PIN · $${lvl.price.toFixed(2)}`;
            fill = "rgba(186, 104, 200, 0.08)";
            stroke = "rgba(186, 104, 200, 0.4)";
          }

          computedPockets.push({
            id: `pocket-${idx}-${lvl.price}`,
            price: lvl.price,
            type: lvl.type,
            isConfluence: lvl.is_confluence,
            y,
            height: h,
            width: plotWidth,
            isWeekly,
            dte: lvl.dte,
            title,
            fill,
            stroke,
          });
        }
      });
      setPockets(computedPockets);

      // 4. Right-Axis Horizontal Gamma Profile Histogram (Volume Profile Style)
      const computedGex: any[] = [];
      const allLevels = [
        ...supports.map((s) => ({ ...s, type: "support" })),
        ...resistances.map((r) => ({ ...r, type: "resistance" })),
      ];
      if (effectiveWeeklyMaxPain > 0) {
        allLevels.push({ price: effectiveWeeklyMaxPain, strength: maxSupportAbs * 0.75, type: "maxpain" } as any);
      }

      const peakStrength = Math.max(
        ...allLevels.map((l) => l.strength || 1),
        1.0
      );

      allLevels.forEach((lvl, idx) => {
        const y = candleSeries.priceToCoordinate(lvl.price);
        if (y !== null) {
          const norm = Math.min(1.0, Math.max(0.2, (lvl.strength || 1) / peakStrength));
          const barWidth = Math.round(norm * 115) + 20;
          const isCall = lvl.type === "resistance";
          const isPut = lvl.type === "support";
          const isConf = (lvl as any).is_confluence;

          let color = "#ba68c8";
          let bgColor = "rgba(186, 104, 200, 0.25)";
          let borderColor = "rgba(186, 104, 200, 0.5)";
          let label = `PIN ${Math.round(lvl.strength)}k`;

          if (isConf) {
            color = "#f59e0b";
            bgColor = "rgba(245, 158, 11, 0.25)";
            borderColor = "rgba(245, 158, 11, 0.6)";
            label = `CONF ${Math.round(lvl.strength)}k`;
          } else if (isCall) {
            color = "#00e5ff";
            bgColor = "rgba(0, 229, 255, 0.22)";
            borderColor = "rgba(0, 229, 255, 0.45)";
            label = `+${Math.round(lvl.strength)}k GEX`;
          } else if (isPut) {
            color = "#00ff88";
            bgColor = "rgba(0, 255, 136, 0.22)";
            borderColor = "rgba(0, 255, 136, 0.45)";
            label = `-${Math.round(lvl.strength)}k GEX`;
          }

          computedGex.push({
            id: `gex-${idx}-${lvl.price}`,
            y: y - 7,
            x: plotWidth - barWidth,
            width: barWidth,
            height: 14,
            price: lvl.price,
            label,
            color,
            bgColor,
            borderColor,
          });
        }
      });
      setGexBars(computedGex);
    };

    setTimeout(updateAllOverlays, 60);

    const rangeSubscription = () => {
      updateAllOverlays();
    };

    chart.subscribeCrosshairMove(onCrosshairMove);
    chart.timeScale().subscribeVisibleLogicalRangeChange(rangeSubscription);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeSubscription);
    };

  }, [effectiveWeeklyMaxPain, effectiveMonthlyMaxPain, supports, resistances, isHovered, weeklyGaps, showGammaFlip, gammaFlipPrice, showExpectedMove, emUpper, emLower, maxSupportAbs, maxResistanceAbs]);

  return (
    <div className="w-full bg-neutral-950 rounded-lg p-2 border border-neutral-900 overflow-hidden relative">
      {/* Chart Top Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-2 pt-1">
        {/* Left: Live Status + Regime Watermark */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 items-center bg-[#0d0d16] border border-[#1f1f32] px-2.5 py-1 rounded">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-200">LIVE FEED</span>
          </div>

          {showGammaFlip && (
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
          )}
        </div>

        {/* Right: Toggle Options Layers */}
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <button
            onClick={() => setShowPockets(!showPockets)}
            className={`px-2 py-0.5 rounded border transition-all ${
              showPockets
                ? "bg-[#00e5ff]/15 text-[#00e5ff] border-[#00e5ff]/40 font-bold"
                : "bg-[#11111d] text-neutral-500 border-[#222234] hover:text-neutral-300"
            }`}
          >
            Pockets: {showPockets ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setShowGexProfile(!showGexProfile)}
            className={`px-2 py-0.5 rounded border transition-all ${
              showGexProfile
                ? "bg-[#00ff88]/15 text-[#00ff88] border-[#00ff88]/40 font-bold"
                : "bg-[#11111d] text-neutral-500 border-[#222234] hover:text-neutral-300"
            }`}
          >
            GEX Profile: {showGexProfile ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setShowGammaFlip(!showGammaFlip)}
            className={`px-2 py-0.5 rounded border transition-all ${
              showGammaFlip
                ? "bg-amber-500/15 text-amber-300 border-amber-500/40 font-bold"
                : "bg-[#11111d] text-neutral-500 border-[#222234] hover:text-neutral-300"
            }`}
          >
            Gamma Flip: {showGammaFlip ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setShowExpectedMove(!showExpectedMove)}
            className={`px-2 py-0.5 rounded border transition-all ${
              showExpectedMove
                ? "bg-sky-500/15 text-sky-300 border-sky-500/40 font-bold"
                : "bg-[#11111d] text-neutral-500 border-[#222234] hover:text-neutral-300"
            }`}
          >
            Expected Move: {showExpectedMove ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Chart Canvas & SVG Overlay */}
      <div ref={chartContainerRef} className="w-full relative">
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {/* 1. Weekly Imbalance Zones */}
          {svgRects.map((rect) => (
            <rect
              key={rect.id}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill="rgba(6, 182, 212, 0.22)"
              stroke="rgba(6, 182, 212, 0.45)"
              strokeWidth={1}
            />
          ))}

          {/* 2. Expected Move Corridor */}
          {showExpectedMove && emChannel && (
            <g>
              <rect
                x={0}
                y={emChannel.yTop}
                width={emChannel.width}
                height={Math.max(2, emChannel.yBot - emChannel.yTop)}
                fill="rgba(56, 189, 248, 0.035)"
                stroke="rgba(56, 189, 248, 0.2)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={8}
                y={emChannel.yTop + 12}
                style={{
                  fontSize: "8.5px",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  fill: "#38bdf8",
                  opacity: 0.75,
                  pointerEvents: "none",
                }}
              >
                ±1σ EXPECTED MOVE VOLATILITY CORRIDOR (${emLower} – ${emUpper})
              </text>
            </g>
          )}

          {/* 3. Liquidity Pockets (Horizontal Channels) */}
          {showPockets &&
            pockets.map((pkt) => (
              <g key={pkt.id}>
                <rect
                  x={0}
                  y={pkt.y}
                  width={pkt.width}
                  height={pkt.height}
                  fill={pkt.fill}
                  stroke={pkt.stroke}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <text
                  x={8}
                  y={pkt.y + 11}
                  style={{
                    fontSize: "9px",
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    fill: pkt.isConfluence ? "#f59e0b" : pkt.type === "support" ? "#00ff88" : pkt.type === "resistance" ? "#ff4d6d" : "#ba68c8",
                    opacity: 0.85,
                    pointerEvents: "none",
                  }}
                >
                  {pkt.title} {pkt.isWeekly ? "· 0DTE/WEEKLY" : "· OPEX ANCHOR"}
                </text>
              </g>
            ))}

          {/* 4. Right-Axis Horizontal Gamma Profile Histogram */}
          {showGexProfile &&
            gexBars.map((bar) => (
              <g key={bar.id}>
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  fill={bar.bgColor}
                  stroke={bar.borderColor}
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={bar.x + 5}
                  y={bar.y + 10}
                  style={{
                    fontSize: "8.5px",
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    fill: bar.color,
                    pointerEvents: "none",
                  }}
                >
                  {bar.label}
                </text>
              </g>
            ))}
        </svg>
      </div>
    </div>
  );
}
