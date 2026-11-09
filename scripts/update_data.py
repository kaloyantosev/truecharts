"""
Refreshes the datasets the website reads at build time:

  src/data/institutional.json  13F institutional ownership (via Yahoo Finance / yfinance)
  src/data/macro.json          policy rates, Fed balance sheet, net liquidity (FRED)
                               and COT commercial positioning (CFTC Public Reporting API)

Run:  pip install yfinance pandas && python scripts/update_data.py
A GitHub Action runs it on a schedule and commits the files when they change.

Method notes (shown on the site as well):
- Institutional % and holder count are Yahoo's aggregates of 13F filings.
- QoQ flow uses each stock's 10 largest 13F holders: share change = shares x pctChange / (1 + pctChange),
  valued at the latest price. It is a top-holder measure, not the full 13F universe.
"""
import csv
import io
import json
import math
import subprocess
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
OUT_INST = ROOT / "src" / "data" / "institutional.json"
OUT_MACRO = ROOT / "src" / "data" / "macro.json"
UA = "truecharts-data/1.0 (+https://github.com/kaloyantosev/truecharts)"

TOP20 = ["MSFT", "AMZN", "AAPL", "NVDA", "GOOGL", "META", "JPM", "AVGO", "V", "LLY",
         "JNJ", "TSLA", "COST", "XOM", "AMD", "HD", "PG", "MA", "UNH", "CRM", "BRK-B", "WMT", "NFLX", "ORCL"]

SECTORS = [
    ("Information Technology", "XLK", ["NVDA", "MSFT", "AAPL", "AVGO", "AMD", "ORCL", "CRM", "CSCO", "INTC"]),
    ("Communication Services", "XLC", ["GOOGL", "META", "NFLX", "DIS", "TMUS", "WBD"]),
    ("Consumer Discretionary", "XLY", ["AMZN", "TSLA", "HD", "BKNG", "NKE", "F"]),
    ("Financials", "XLF", ["JPM", "V", "MA", "GS", "BAC", "MS"]),
    ("Health Care", "XLV", ["LLY", "UNH", "JNJ", "ABBV", "MRK", "ISRG"]),
    ("Industrials", "XLI", ["GE", "CAT", "RTX", "HON", "LMT", "BA"]),
    ("Consumer Staples", "XLP", ["WMT", "COST", "PG", "KO", "PEP", "TGT"]),
    ("Materials", "XLB", ["LIN", "SHW", "FCX", "NEM", "APD", "DOW"]),
    ("Utilities", "XLU", ["NEE", "SO", "DUK", "CEG", "VST", "AEP"]),
    ("Real Estate", "XLRE", ["PLD", "AMT", "EQIX", "WELL", "PSA", "O", "SPG"]),
    ("Energy", "XLE", ["XOM", "CVX", "COP", "EOG", "OXY", "PSX", "MPC", "VLO"]),
]
SECTOR_LABEL = {"XLK": "Tech", "XLC": "Comm Serv", "XLY": "Cons Disc", "XLF": "Financials", "XLV": "Healthcare",
                "XLI": "Industrials", "XLP": "Staples", "XLB": "Materials", "XLU": "Utilities", "XLRE": "Real Estate",
                "XLE": "Energy"}
BUBBLES = ["NVDA", "MSFT", "AAPL", "AMZN", "GOOGL", "META", "AVGO", "JPM", "LLY", "TSLA", "XOM", "CRM"]


# ── helpers ────────────────────────────────────────────────────────────────────

def fmt_money(v: float) -> str:
    a = abs(v)
    s = "-" if v < 0 else ""
    if a >= 1e12: return f"{s}${a / 1e12:.2f}T"
    if a >= 1e9: return f"{s}${a / 1e9:.1f}B"
    if a >= 1e6: return f"{s}${a / 1e6:.0f}M"
    return f"{s}${a:,.0f}"


def fmt_shares(v: float, signed=True) -> str:
    a = abs(v)
    sign = ("+" if v >= 0 else "-") if signed else ""
    if a >= 1e9: return f"{sign}{a / 1e9:.2f}B"
    if a >= 1e6: return f"{sign}{a / 1e6:.1f}M"
    if a >= 1e3: return f"{sign}{a / 1e3:.0f}K"
    return f"{sign}{a:.0f}"


def pct(v: float, d=2) -> str:
    return f"{'+' if v >= 0 else ''}{v:.{d}f}%"


def quarter_of(d) -> str:
    return f"Q{(d.month - 1) // 3 + 1} {d.year}"


# ── 13F institutional ──────────────────────────────────────────────────────────

def stock_snapshot(sym: str, price: float):
    t = yf.Ticker(sym)
    mh = t.major_holders
    vals = {}
    if mh is not None and not mh.empty:
        col = mh.columns[-1]
        vals = {str(k): float(v) for k, v in mh[col].items()}
    ih = t.institutional_holders
    holders = []
    if ih is not None and not ih.empty:
        for _, r in ih.head(10).iterrows():
            sh = float(r.get("Shares") or 0)
            chg = float(r.get("pctChange") or 0)
            holders.append({
                "holder": str(r.get("Holder")),
                "shares": sh,
                "pctChange": chg,
                "reported": str(r.get("Date Reported"))[:10],
            })
    try:
        name = t.info.get("shortName") or sym
        mcap = float(t.fast_info["marketCap"] or 0)
    except Exception:
        name, mcap = sym, 0.0
    # Net share change among the top-10 holders (shares now minus shares last quarter)
    delta = sum(h["shares"] * h["pctChange"] / (1 + h["pctChange"]) for h in holders if h["pctChange"] > -1)
    prior = sum(h["shares"] / (1 + h["pctChange"]) for h in holders if h["pctChange"] > -1)
    return {
        "symbol": sym,
        "name": name,
        "instPct": vals.get("institutionsPercentHeld", float("nan")) * 100,
        "holders": int(vals.get("institutionsCount", 0) or 0),
        "mcap": mcap,
        "price": price,
        "topHolders": holders,
        "netShares": delta,
        "netValue": delta * price,
        "flowPct": (delta / prior * 100) if prior > 0 else 0.0,
    }


def build_institutional():
    universe = sorted(set(TOP20) | {s for _, _, ss in SECTORS for s in ss} | set(BUBBLES))
    px = yf.download(universe, period="6mo", interval="1d", auto_adjust=True, progress=False, threads=True)["Close"]
    last = {s: float(px[s].dropna().iloc[-1]) for s in universe if s in px and not px[s].dropna().empty}
    perf3m = {}
    for s in universe:
        ser = px[s].dropna() if s in px else []
        if len(ser) > 63:
            perf3m[s] = (float(ser.iloc[-1]) / float(ser.iloc[-64]) - 1) * 100

    snaps, failed = {}, []
    for s in universe:
        if s not in last:
            failed.append(s)
            continue
        try:
            snaps[s] = stock_snapshot(s, last[s])
        except Exception as e:  # keep going; a missing stock is dropped, never invented
            print(f"  {s}: {e}", file=sys.stderr)
            failed.append(s)

    dates = [h["reported"] for sn in snaps.values() for h in sn["topHolders"]]
    latest_q = quarter_of(datetime.strptime(Counter(dates).most_common(1)[0][0], "%Y-%m-%d")) if dates else None

    def trend(flow):
        return "Accumulation" if flow >= 1 else "Distribution" if flow <= -1 else "Neutral"

    top = [snaps[s] for s in TOP20 if s in snaps and snaps[s]["holders"] > 0]
    top.sort(key=lambda x: x["holders"], reverse=True)
    sector_of = {s: code for _, code, ss in SECTORS for s in ss}
    top20 = []
    for i, sn in enumerate(top[:20], 1):
        inst_value = sn["mcap"] * sn["instPct"] / 100 if not math.isnan(sn["instPct"]) else 0
        top20.append({
            "rank": i,
            "symbol": sn["symbol"],
            "name": sn["name"],
            "sector": SECTOR_LABEL.get(sector_of.get(sn["symbol"], ""), "—"),
            "holders": sn["holders"],
            "instPct": round(sn["instPct"], 1),
            "valB": fmt_money(inst_value),
            "holderChg": pct(sn["flowPct"], 1),
            "trend": trend(sn["flowPct"]),
            "topHolders": [{
                "holder": h["holder"],
                "shares": f"{h['shares']:,.0f}",
                "val": fmt_money(h["shares"] * sn["price"]),
                "pct": pct(h["pctChange"] * 100),
                "reported": h["reported"],
            } for h in sn["topHolders"][:5]],
        })

    sectors = []
    for name, code, syms in SECTORS:
        rows = [snaps[s] for s in syms if s in snaps and snaps[s]["topHolders"]]
        net = sum(r["netValue"] for r in rows) / 1e9

        def row(r):
            return {"ticker": r["symbol"], "shares": fmt_shares(r["netShares"]),
                    "value": fmt_money(abs(r["netValue"])), "flow": pct(r["flowPct"])}
        buys = sorted([r for r in rows if r["netValue"] > 0], key=lambda r: -r["netValue"])[:5]
        sells = sorted([r for r in rows if r["netValue"] < 0], key=lambda r: r["netValue"])[:3]
        sectors.append({"name": name, "code": code, "netFlow": round(net, 2),
                        "topBuyStocks": [row(r) for r in buys], "topSellStocks": [row(r) for r in sells]})
    sectors.sort(key=lambda s: -s["netFlow"])
    max_flow = max((abs(s["netFlow"]) for s in sectors), default=1) or 1
    for s in sectors:
        s["maxFlow"] = round(max_flow, 2)

    bubbles = []
    for s in BUBBLES:
        sn = snaps.get(s)
        if not sn or s not in perf3m or math.isnan(sn["instPct"]):
            continue
        bubbles.append({
            "ticker": s,
            "sizeB": round(sn["mcap"] * sn["instPct"] / 100 / 1e9, 1),
            "qoqChg": round(sn["flowPct"], 2),
            "perf3M": round(perf3m[s], 1),
        })

    by_symbol = {s: {
        "instPct": None if math.isnan(sn["instPct"]) else round(sn["instPct"], 1),
        "holders": sn["holders"],
        "flowPct": round(sn["flowPct"], 2),
        "trend": trend(sn["flowPct"]),
    } for s, sn in snaps.items()}

    return {
        "asOf": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "latestFilingQuarter": latest_q,
        "source": "SEC 13F filings aggregated by Yahoo Finance (yfinance)",
        "method": "Flow = net share change of each stock's 10 largest 13F holders vs. the prior quarter, valued at the latest price.",
        "top20": top20,
        "sectors": sectors,
        "bubbles": bubbles,
        "bySymbol": by_symbol,
        "missing": failed,
    }


# ── macro: FRED + CFTC ─────────────────────────────────────────────────────────

def get(url: str) -> str:
    res = subprocess.run(["curl", "-sSfL", "--retry", "4", "--retry-all-errors", "--retry-delay", "3",
                          "-A", UA, url], capture_output=True, text=True, timeout=120)
    if res.returncode != 0:
        raise RuntimeError(f"{url}: {res.stderr.strip()}")
    return res.stdout


def fred(series: str, start: str = "2014-01-01") -> list[tuple[str, float]]:
    rows = csv.reader(io.StringIO(get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}&cosd={start}")))
    next(rows)
    return [(d, float(v)) for d, v in rows if v not in ("", ".")]


def value_on_or_before(series, d: str):
    out = None
    for dd, v in series:
        if dd <= d:
            out = v
        else:
            break
    return out


COT = [("ES", "E-mini S&P 500", "13874A"), ("NQ", "E-mini Nasdaq 100", "209742"),
       ("6E", "Euro FX", "099741"), ("CL", "WTI Crude Oil", "067651")]


def cot_rows():
    out = []
    since = (date.today() - timedelta(days=380)).isoformat()
    for sym, name, code in COT:
        q = ("https://publicreporting.cftc.gov/resource/6dca-aqww.json?"
             f"$select=report_date_as_yyyy_mm_dd,open_interest_all,comm_positions_long_all,comm_positions_short_all"
             f"&$where=cftc_contract_market_code='{code}'%20AND%20report_date_as_yyyy_mm_dd>='{since}'"
             f"&$order=report_date_as_yyyy_mm_dd%20ASC&$limit=200")
        rows = json.loads(get(q))
        series = [((float(r["comm_positions_long_all"]) - float(r["comm_positions_short_all"]))
                   / float(r["open_interest_all"]) * 100, r["report_date_as_yyyy_mm_dd"][:10]) for r in rows
                  if float(r.get("open_interest_all") or 0) > 0]
        if len(series) < 20:
            continue
        cur, d = series[-1]
        window = [v for v, _ in series[-52:]]
        pctile = round(sum(v < cur for v in window) / len(window) * 100)
        signal = ("Extreme long" if pctile >= 90 else "Long bias" if pctile >= 70 else
                  "Extreme short" if pctile <= 10 else "Short bias" if pctile <= 30 else "Neutral")
        out.append({"symbol": sym, "name": name, "netCommPct": round(cur, 1), "percentile": pctile,
                    "signal": signal, "reportDate": d})
    return out


def build_macro():
    lo, hi = fred("DFEDTARL", "2022-01-01"), fred("DFEDTARU", "2022-01-01")
    ecb, us10 = fred("ECBDFR", "2022-01-01"), fred("DGS10", "2024-01-01")
    spx = fred("SP500", (date.today() - timedelta(days=400)).isoformat())
    walcl, tga = fred("WALCL", "2023-01-01"), fred("WTREGEN", "2023-01-01")
    rrp, m2 = fred("RRPONTSYD", "2023-01-01"), fred("M2SL", "2023-01-01")

    # Fed target-range changes in the last 24 months
    cutoff = (date.today() - timedelta(days=730)).isoformat()
    events = []
    for i in range(1, len(hi)):
        if hi[i][1] != hi[i - 1][1] and hi[i][0] >= cutoff:
            d = hi[i][0]
            l = value_on_or_before(lo, d)
            move = round((hi[i][1] - hi[i - 1][1]) * 100)
            events.append({"date": d, "fed": f"{l:.2f}%-{hi[i][1]:.2f}%",
                           "label": f"Fed {'cut' if move < 0 else 'hike'} {abs(move)} bp",
                           "type": "bullish" if move < 0 else "bearish"})

    # Net liquidity = Fed assets - TGA - reverse repo (weekly, $ billions)
    rrp_b = rrp  # already $B
    net_liq = []
    for d, assets in walcl:
        t = value_on_or_before(tga, d)
        r = value_on_or_before(rrp_b, d)
        if t is None or r is None:
            continue
        net_liq.append((d, assets / 1000 - t / 1000 - r))
    nl_now, nl_13w = net_liq[-1][1], net_liq[-14][1]
    walcl_now, walcl_4w = walcl[-1][1] / 1e6, walcl[-5][1] / 1e6  # $ trillions
    m2_yoy = (m2[-1][1] / m2[-13][1] - 1) * 100

    # Correlation of weekly changes: net liquidity vs S&P 500, last 52 weeks
    pairs = []
    for i in range(len(net_liq) - 52, len(net_liq)):
        if i < 1:
            continue
        d0, d1 = net_liq[i - 1][0], net_liq[i][0]
        s0, s1 = value_on_or_before(spx, d0), value_on_or_before(spx, d1)
        if s0 and s1:
            pairs.append((net_liq[i][1] - net_liq[i - 1][1], s1 / s0 - 1))
    corr = None
    if len(pairs) > 20:
        xs, ys = zip(*pairs)
        mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
        cov = sum((x - mx) * (y - my) for x, y in pairs)
        sx = math.sqrt(sum((x - mx) ** 2 for x in xs)); sy = math.sqrt(sum((y - my) ** 2 for y in ys))
        corr = round(cov / (sx * sy), 2) if sx and sy else None

    spx_weekly = spx[::5]
    if spx_weekly[-1] != spx[-1]:
        spx_weekly.append(spx[-1])
    year_ago = value_on_or_before(spx, (date.fromisoformat(spx[-1][0]) - timedelta(days=365)).isoformat())

    return {
        "asOf": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source": "FRED (Federal Reserve Bank of St. Louis), CFTC Commitments of Traders (legacy, futures only)",
        "rates": {
            "fed": {"value": f"{lo[-1][1]:.2f} - {hi[-1][1]:.2f}%", "date": hi[-1][0]},
            "ecb": {"value": f"{ecb[-1][1]:.2f}%", "date": ecb[-1][0], "label": "ECB deposit"},
            "us10y": {"value": f"{us10[-1][1]:.2f}%", "date": us10[-1][0], "label": "US 10Y"},
        },
        "policyEvents": events[-6:],
        "spx": {"points": [[d, round(v, 2)] for d, v in spx_weekly], "chg12m": round((spx[-1][1] / year_ago - 1) * 100, 1) if year_ago else None},
        "liquidity": {
            "fedAssetsT": round(walcl_now, 2),
            "fedAssets4wChangeB": round((walcl_now - walcl_4w) * 1000, 0),
            "fedAssetsDate": walcl[-1][0],
            "m2YoY": round(m2_yoy, 1),
            "m2Date": m2[-1][0],
            "netLiquidityT": round(nl_now / 1000, 2),
            "netLiquidity13wPct": round((nl_now / nl_13w - 1) * 100, 1),
            "netLiquidityDate": net_liq[-1][0],
            "spxCorr52w": corr,
            "regime": "Expanding" if nl_now > nl_13w else "Contracting",
        },
        "cot": cot_rows(),
    }


def main():
    inst = build_institutional()
    OUT_INST.write_text(json.dumps(inst, indent=1), encoding="utf-8")
    print(f"institutional.json: {len(inst['top20'])} top-20, {len(inst['sectors'])} sectors, "
          f"{len(inst['bubbles'])} bubbles, filing quarter {inst['latestFilingQuarter']}, missing {inst['missing']}")
    macro = build_macro()
    OUT_MACRO.write_text(json.dumps(macro, indent=1), encoding="utf-8")
    print(f"macro.json: Fed {macro['rates']['fed']['value']}, net liquidity ${macro['liquidity']['netLiquidityT']}T, "
          f"{len(macro['cot'])} COT rows, {len(macro['policyEvents'])} policy events")


if __name__ == "__main__":
    main()
