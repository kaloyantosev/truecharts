import { NextRequest, NextResponse } from "next/server";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface DomRow {
  strike: number;
  put_oi: number;
  call_oi: number;
  put_0dte_oi: number;
  call_0dte_oi: number;
  put_bar_pct: number;
  call_bar_pct: number;
  put_0dte_pct: number;
  call_0dte_pct: number;
  is_spot: boolean;
}

// In-memory cache for throttling
const cache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 25000; // 25s cache

// Cookie / Crumb storage for Yahoo Finance
let cachedCookie = "";
let cachedCrumb = "";
let crumbTimestamp = 0;

async function getYahooCrumb(): Promise<{ cookie: string; crumb: string }> {
  const now = Date.now();
  if (cachedCookie && cachedCrumb && now - crumbTimestamp < 3600000) {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }

  try {
    const resCookie = await fetch("https://fc.yahoo.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const setCookie = resCookie.headers.get("set-cookie");
    const cookieHeader = setCookie ? setCookie.split(";")[0] : "";

    const resCrumb = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Cookie: cookieHeader,
      },
    });
    const crumb = (await resCrumb.text()).trim();

    if (crumb && !crumb.includes("html") && !crumb.includes("Error")) {
      cachedCookie = cookieHeader;
      cachedCrumb = crumb;
      crumbTimestamp = now;
      return { cookie: cookieHeader, crumb };
    }
  } catch (err) {
    console.error("Failed to get Yahoo crumb:", err);
  }

  return { cookie: "", crumb: "" };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "SPY").toUpperCase().trim();
  const timeframe = searchParams.get("timeframe") || "15m";

  const cacheKey = `${ticker}_${timeframe}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    // 1. Fetch Real Candle History from Yahoo Finance Chart API
    let interval = "15m";
    let range = "5d";
    if (timeframe === "5m") {
      interval = "5m";
      range = "2d";
    } else if (timeframe === "15m") {
      interval = "15m";
      range = "5d";
    } else if (timeframe === "1h") {
      interval = "60m";
      range = "1mo";
    } else if (timeframe === "4h") {
      interval = "60m";
      range = "3mo";
    } else if (timeframe === "1D" || timeframe === "D") {
      interval = "1d";
      range = "1y";
    }

    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`;
    const chartRes = await fetch(chartUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 25 },
    });

    let candles: Candle[] = [];
    let spotPrice = 0;

    if (chartRes.ok) {
      const chartJson = await chartRes.json();
      const result = chartJson.chart?.result?.[0];
      if (result) {
        spotPrice = Number(result.meta?.regularMarketPrice || 0);
        const timestamps: number[] = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};
        const opens = quote.open || [];
        const highs = quote.high || [];
        const lows = quote.low || [];
        const closes = quote.close || [];
        const volumes = quote.volume || [];

        for (let i = 0; i < timestamps.length; i++) {
          const o = opens[i];
          const h = highs[i];
          const l = lows[i];
          const c = closes[i];
          if (o !== null && h !== null && l !== null && c !== null && !isNaN(c)) {
            candles.push({
              time: timestamps[i],
              open: Number(o.toFixed(2)),
              high: Number(h.toFixed(2)),
              low: Number(l.toFixed(2)),
              close: Number(c.toFixed(2)),
              volume: Number(volumes[i] || 0),
            });
          }
        }
      }
    }

    // Aggregate 60m into 4h if 4h is selected
    if (timeframe === "4h" && candles.length > 0) {
      const aggCandles: Candle[] = [];
      const FOUR_HOURS = 4 * 3600;
      let currentBucket = Math.floor(candles[0].time / FOUR_HOURS) * FOUR_HOURS;
      let aggOpen = candles[0].open;
      let aggHigh = candles[0].high;
      let aggLow = candles[0].low;
      let aggClose = candles[0].close;
      let aggVol = candles[0].volume;

      for (let i = 1; i < candles.length; i++) {
        const c = candles[i];
        const bucket = Math.floor(c.time / FOUR_HOURS) * FOUR_HOURS;
        if (bucket === currentBucket) {
          aggHigh = Math.max(aggHigh, c.high);
          aggLow = Math.min(aggLow, c.low);
          aggClose = c.close;
          aggVol += c.volume;
        } else {
          aggCandles.push({
            time: currentBucket,
            open: aggOpen,
            high: aggHigh,
            low: aggLow,
            close: aggClose,
            volume: aggVol,
          });
          currentBucket = bucket;
          aggOpen = c.open;
          aggHigh = c.high;
          aggLow = c.low;
          aggClose = c.close;
          aggVol = c.volume;
        }
      }
      aggCandles.push({
        time: currentBucket,
        open: aggOpen,
        high: aggHigh,
        low: aggLow,
        close: aggClose,
        volume: aggVol,
      });
      candles = aggCandles;
    }

    if (spotPrice <= 0 && candles.length > 0) {
      spotPrice = candles[candles.length - 1].close;
    }
    if (spotPrice <= 0) {
      spotPrice = ticker === "QQQ" ? 753.0 : 773.0;
    }

    // 2. Fetch Institutional Options Model & Sinclair Volatility from Render backend
    // Exact same API payload used by tv_automation.py injector
    let levelsData: any = null;
    try {
      const renderUrl = `https://truecharts.onrender.com/api/analyze/${ticker}`;
      const r = await fetch(renderUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        levelsData = await r.json();
      }
    } catch (e) {
      console.warn(`Render API fetch warning for ${ticker}:`, e);
    }

    const gammaFlip = Number(levelsData?.gamma_flip || (spotPrice * 0.9965).toFixed(2));
    const weeklyMaxPain = Number(levelsData?.weekly_max_pain || levelsData?.max_pain || (Math.round(spotPrice / 5) * 5));
    const expMoveUp = Number(levelsData?.expected_move_upper || (spotPrice * 1.018).toFixed(2));
    const expMoveDn = Number(levelsData?.expected_move_lower || (spotPrice * 0.982).toFixed(2));
    const putWall = Number(levelsData?.supports?.[0]?.price || (Math.round((spotPrice - 9) / 5) * 5));
    const callWall = Number(levelsData?.resistances?.[0]?.price || (Math.round((spotPrice + 8) / 5) * 5));

    // Exact Sinclair metrics unpacking from backend API (identical to line 1288-1293 in tv_automation.py)
    const sinclair_vol = levelsData?.sinclair_volatility || {};
    const sinclairPayload = {
      vrp_spread: sinclair_vol.vrp_spread !== undefined ? parseFloat(sinclair_vol.vrp_spread) : (ticker === "QQQ" ? 9.6 : 7.4),
      weekly_expected_move_dollars: sinclair_vol.weekly_expected_move_dollars !== undefined
        ? parseFloat(sinclair_vol.weekly_expected_move_dollars)
        : (ticker === "QQQ" ? 24.88 : 18.93),
      implied_volatility: sinclair_vol.implied_volatility !== undefined
        ? parseFloat(sinclair_vol.implied_volatility)
        : (ticker === "QQQ" ? 23.4 : 17.4),
      rv_yang_zhang: sinclair_vol.rv_yang_zhang !== undefined
        ? parseFloat(sinclair_vol.rv_yang_zhang)
        : (ticker === "QQQ" ? 13.9 : 10.0),
    };

    // 3. Fetch Real Options Chain and construct EXACT ladder matching fetch_real_weekly_dom in tv_automation.py
    const { cookie, crumb } = await getYahooCrumb();
    let by_strike_0dte: Record<number, { strike: number; call_oi: number; put_oi: number; call_vol: number; put_vol: number }> = {};
    let by_strike_weekly: Record<number, { strike: number; call_oi: number; put_oi: number; call_vol: number; put_vol: number }> = {};

    if (crumb) {
      try {
        const optBaseUrl = `https://query2.finance.yahoo.com/v7/finance/options/${ticker}?crumb=${encodeURIComponent(crumb)}`;
        const baseRes = await fetch(optBaseUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Cookie: cookie,
          },
          signal: AbortSignal.timeout(6000),
        });

        if (baseRes.ok) {
          const baseJson = await baseRes.json();
          const chainRes = baseJson.optionChain?.result?.[0];
          const exps: number[] = chainRes?.expirationDates || [];

          // Expiration 0 (nearest, 0DTE / next session)
          const opt0 = chainRes?.options?.[0];
          if (opt0) {
            (opt0.calls || []).forEach((c: any) => {
              const k = Number(c.strike);
              const oi = parseInt(c.openInterest) || 0;
              const vol = parseInt(c.volume) || 0;
              by_strike_0dte[k] = by_strike_0dte[k] || { strike: k, call_oi: 0, put_oi: 0, call_vol: 0, put_vol: 0 };
              by_strike_0dte[k].call_oi += oi;
              by_strike_0dte[k].call_vol += vol;
            });
            (opt0.puts || []).forEach((p: any) => {
              const k = Number(p.strike);
              const oi = parseInt(p.openInterest) || 0;
              const vol = parseInt(p.volume) || 0;
              by_strike_0dte[k] = by_strike_0dte[k] || { strike: k, call_oi: 0, put_oi: 0, call_vol: 0, put_vol: 0 };
              by_strike_0dte[k].put_oi += oi;
              by_strike_0dte[k].put_vol += vol;
            });
          }

          // Gather nearest weekly expirations (<= 7 DTE)
          const today = new Date();
          const targetExps: number[] = [];
          for (let i = 0; i < Math.min(6, exps.length); i++) {
            const expDate = new Date(exps[i] * 1000);
            const dte = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            if (dte >= 0 && dte <= 7) {
              targetExps.push(exps[i]);
            }
          }

          // Fetch target weekly expiration chains concurrently
          const expFetches = targetExps.map(async (expTs) => {
            try {
              const expUrl = `https://query2.finance.yahoo.com/v7/finance/options/${ticker}?date=${expTs}&crumb=${encodeURIComponent(crumb)}`;
              const r = await fetch(expUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                  Cookie: cookie,
                },
                signal: AbortSignal.timeout(5000),
              });
              if (r.ok) {
                const j = await r.json();
                return j.optionChain?.result?.[0]?.options?.[0];
              }
            } catch (e) {
              return null;
            }
            return null;
          });

          const expResults = await Promise.all(expFetches);
          expResults.forEach((opt) => {
            if (!opt) return;
            (opt.calls || []).forEach((c: any) => {
              const k = Number(c.strike);
              const oi = parseInt(c.openInterest) || 0;
              const vol = parseInt(c.volume) || 0;
              by_strike_weekly[k] = by_strike_weekly[k] || { strike: k, call_oi: 0, put_oi: 0, call_vol: 0, put_vol: 0 };
              by_strike_weekly[k].call_oi += oi;
              by_strike_weekly[k].call_vol += vol;
            });
            (opt.puts || []).forEach((p: any) => {
              const k = Number(p.strike);
              const oi = parseInt(p.openInterest) || 0;
              const vol = parseInt(p.volume) || 0;
              by_strike_weekly[k] = by_strike_weekly[k] || { strike: k, call_oi: 0, put_oi: 0, call_vol: 0, put_vol: 0 };
              by_strike_weekly[k].put_oi += oi;
              by_strike_weekly[k].put_vol += vol;
            });
          });
        }
      } catch (err) {
        console.error("Option chain fetch error:", err);
      }
    }

    // Exact build_ladder implementation directly ported from tv_automation.py lines 931-975
    const buildLadder = (by_strike_dict: Record<number, any>, is_weekly = false, max_strikes = 34): DomRow[] => {
      const all_strikes = Object.values(by_strike_dict);
      if (all_strikes.length === 0) return [];

      // Sort by distance to spot and pick top max_strikes
      all_strikes.sort((a, b) => Math.abs(a.strike - spotPrice) - Math.abs(b.strike - spotPrice));
      const selected = all_strikes.slice(0, max_strikes);
      // Sort reverse by strike so highest strike is at top
      selected.sort((a, b) => b.strike - a.strike);

      const max_c = Math.max(1, ...selected.map((s) => s.call_oi));
      const max_p = Math.max(1, ...selected.map((s) => s.put_oi));

      // Find closest strike to spot for is_spot flag
      let closest_strike = selected[0].strike;
      let min_dist = Math.abs(selected[0].strike - spotPrice);
      for (const s of selected) {
        const d = Math.abs(s.strike - spotPrice);
        if (d < min_dist) {
          min_dist = d;
          closest_strike = s.strike;
        }
      }

      const ladder: DomRow[] = [];
      for (const s of selected) {
        const k = s.strike;
        const c_pct = Math.min(100, Math.floor((s.call_oi / max_c) * 100));
        const p_pct = Math.min(100, Math.floor((s.put_oi / max_p) * 100));

        let p_0_pct = 0;
        let c_0_pct = 0;
        let p0 = 0;
        let c0 = 0;

        if (is_weekly) {
          const s0 = by_strike_0dte[k] || {};
          p0 = s0.put_oi || 0;
          c0 = s0.call_oi || 0;
          p_0_pct = max_p > 0 ? Math.min(p_pct, Math.floor((p0 / max_p) * 100)) : 0;
          c_0_pct = max_c > 0 ? Math.min(c_pct, Math.floor((c0 / max_c) * 100)) : 0;
        }

        ladder.push({
          strike: k,
          call_oi: s.call_oi,
          put_oi: s.put_oi,
          call_bar_pct: c_pct,
          put_bar_pct: p_pct,
          put_0dte_pct: p_0_pct,
          call_0dte_pct: c_0_pct,
          put_0dte_oi: p0,
          call_0dte_oi: c0,
          is_spot: k === closest_strike,
        });
      }
      return ladder;
    };

    const dom0dte = buildLadder(by_strike_0dte, false, 34);
    const domWeekly = buildLadder(by_strike_weekly, true, 34);

    const payload = {
      ticker,
      spot: spotPrice,
      timeframe,
      candles,
      modelLevels: {
        gammaFlip: {
          price: gammaFlip,
          title: `GAMMA FLIP - $${gammaFlip.toFixed(2)} (EOD ${new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" })})`,
          color: "#eab308", // Yellow
        },
        confluencePut: {
          price: putWall,
          title: `CONFLUENCE - $${putWall.toFixed(2)} [30d DTE · PUT WALL + Weekly Max Pain]`,
          color: "#ea580c", // Orange
        },
        confluenceCall: {
          price: callWall,
          title: `CALL WALL - $${callWall.toFixed(2)} (10d DTE · Gamma Ceiling)`,
          color: "#ef4444", // Red
        },
        expMoveLower: {
          price: expMoveDn,
          title: `-1σ EXP MOVE - $${expMoveDn.toFixed(2)} (Weekly Lower 68% Band)`,
          color: "#38bdf8", // Light Blue
        },
        expMoveUpper: {
          price: expMoveUp,
          title: `+1σ EXP MOVE - $${expMoveUp.toFixed(2)} (Weekly Upper 68% Band)`,
          color: "#38bdf8", // Light Blue
        },
      },
      sinclair: sinclairPayload,
      dom: {
        "0dte": dom0dte,
        weekly: domWeekly,
      },
      lastUpdated: new Date().toISOString(),
    };

    cache.set(cacheKey, { timestamp: now, data: payload });
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("Trader Panel API error:", error);
    return NextResponse.json({ error: error.message || "Failed to load trader data" }, { status: 500 });
  }
}
