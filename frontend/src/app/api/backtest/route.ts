import { NextRequest, NextResponse } from "next/server";
import spyData from "@/data/backtest/SPY.json";
import qqqData from "@/data/backtest/QQQ.json";

function unpackDom(rawDom: any, spot: number) {
  if (!rawDom) return { "0dte": [], weekly: [] };

  const unpackList = (list: any[], isWeekly: boolean) => {
    if (!Array.isArray(list)) return [];
    if (list.length === 0) return [];
    if (!Array.isArray(list[0])) return list;

    let maxC = 1;
    let maxP = 1;
    for (const row of list) {
      const pOi = Number(row[1]) || 0;
      const cOi = Number(row[2]) || 0;
      if (pOi > maxP) maxP = pOi;
      if (cOi > maxC) maxC = cOi;
    }

    let closestStrike = Number(list[0][0]);
    let minDiff = Math.abs(closestStrike - spot);
    for (const row of list) {
      const st = Number(row[0]);
      const diff = Math.abs(st - spot);
      if (diff < minDiff) {
        minDiff = diff;
        closestStrike = st;
      }
    }

    return list.map((row: any[]) => {
      const strike = Number(row[0]);
      const put_oi = Number(row[1]) || 0;
      const call_oi = Number(row[2]) || 0;
      const put_0dte_oi = row[3] !== undefined ? Number(row[3]) : (isWeekly ? 0 : put_oi);
      const call_0dte_oi = row[4] !== undefined ? Number(row[4]) : (isWeekly ? 0 : call_oi);

      const put_bar_pct = Math.min(100, Math.round((put_oi / maxP) * 100));
      const call_bar_pct = Math.min(100, Math.round((call_oi / maxC) * 100));
      const put_0dte_pct = isWeekly ? Math.min(put_bar_pct, Math.round((put_0dte_oi / maxP) * 100)) : put_bar_pct;
      const call_0dte_pct = isWeekly ? Math.min(call_bar_pct, Math.round((call_0dte_oi / maxC) * 100)) : call_bar_pct;

      return {
        strike,
        put_oi,
        call_oi,
        put_bar_pct,
        call_bar_pct,
        put_0dte_pct,
        call_0dte_pct,
        put_0dte_oi,
        call_0dte_oi,
        is_spot: strike === closestStrike,
      };
    });
  };

  return {
    "0dte": unpackList(rawDom["0dte"], false),
    weekly: unpackList(rawDom["weekly"], true),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = (searchParams.get("ticker") || "SPY").toUpperCase().trim();
    const timeframe = (searchParams.get("timeframe") || "5m").toLowerCase();
    const requestedDate = searchParams.get("date") || "";

    const dataset = ticker === "QQQ" ? qqqData : spyData;
    const availableDates = dataset.available_dates;

    if (!availableDates || availableDates.length === 0) {
      return NextResponse.json({ error: "No historical dates available" }, { status: 404 });
    }

    // Default to the latest available date if not specified or invalid
    const selectedDate = availableDates.includes(requestedDate)
      ? requestedDate
      : availableDates[availableDates.length - 1];

    const dayData = (dataset.days as Record<string, any>)[selectedDate];
    if (!dayData) {
      return NextResponse.json({ error: `No data for date: ${selectedDate}` }, { status: 404 });
    }

    const validTimeframe = ["5m", "15m", "1h"].includes(timeframe) ? timeframe : "5m";
    const rawCandles = Array.isArray(dayData.candles)
      ? dayData.candles
      : dayData.candles[validTimeframe] || dayData.candles["5m"] || [];

    const candles = rawCandles.map((b: any) => {
      if (Array.isArray(b)) {
        return {
          time: b[0],
          open: b[1],
          high: b[2],
          low: b[3],
          close: b[4],
          volume: b[5] || 0,
        };
      }
      return b;
    });

    const spot = dayData.spot ?? dayData.spot_at_0940 ?? (candles[2] ? candles[2].close : 0);
    const dom = unpackDom(dayData.dom, spot);

    const payload = {
      ticker,
      availableDates,
      selectedDate,
      timeframe: validTimeframe,
      spot,
      sinclair: dayData.sinclair,
      levels: dayData.levels,
      dom,
      candles,
      summary: {
        sessionHours: "09:30 - 16:00 US Eastern (RTH only)",
        sofiaHours: "16:30 - 23:00 Europe/Sofia",
        snapshotTime: "09:40 US Eastern (10 min after open)",
        totalCandles: candles.length,
      },
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("Backtest API error:", err);
    return NextResponse.json({ error: err.message || "Failed to load backtest data" }, { status: 500 });
  }
}
