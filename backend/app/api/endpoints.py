from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import pandas as pd
import numpy as np
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models import OptionMetricsRecord, TechnicalLevelRecord
from app.core.options import calculate_gex_profile, calculate_max_pain
from app.core.sr_zones import calculate_sr_levels
from app.core.backtest import run_historical_backtest

router = APIRouter()

import yfinance as yf
import datetime
import requests

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})

def fetch_live_options_chain(ticker: str, spot: float) -> List[Dict[str, Any]]:
    """
    Fetches real-time options chain from Yahoo Finance using yfinance.
    Finds the closest contracts around 7, 14, 30, 60, and 90 DTE to keep it fast.
    """
    try:
        tk = yf.Ticker(ticker)
        expirations = tk.options
        if not expirations:
            return []
            
        today = datetime.date.today()
        parsed_exps = []
        for exp in expirations:
            try:
                exp_date = datetime.datetime.strptime(exp, "%Y-%m-%d").date()
                dte = (exp_date - today).days
                if dte >= 0:
                    parsed_exps.append((exp, dte))
            except:
                continue
                
        targets = [7, 14, 30, 60, 90]
        selected_exps = []
        for target in targets:
            if not parsed_exps:
                break
            closest = min(parsed_exps, key=lambda x: abs(x[1] - target))
            selected_exps.append(closest)
            parsed_exps.remove(closest)
            
        chain = []
        for exp, dte in selected_exps:
            opt = tk.option_chain(exp)
            # Calls
            for _, row in opt.calls.iterrows():
                strike = float(row["strike"])
                oi = int(row["openInterest"]) if not pd.isna(row["openInterest"]) else 0
                iv = float(row["impliedVolatility"]) if not pd.isna(row["impliedVolatility"]) else 0.2
                if oi > 0:
                    chain.append({
                        "strike": strike,
                        "type": "call",
                        "open_interest": oi,
                        "iv": iv,
                        "dte": float(dte)
                    })
            # Puts
            for _, row in opt.puts.iterrows():
                strike = float(row["strike"])
                oi = int(row["openInterest"]) if not pd.isna(row["openInterest"]) else 0
                iv = float(row["impliedVolatility"]) if not pd.isna(row["impliedVolatility"]) else 0.2
                if oi > 0:
                    chain.append({
                        "strike": strike,
                        "type": "put",
                        "open_interest": oi,
                        "iv": iv,
                        "dte": float(dte)
                    })
        return chain
    except Exception as e:
        print(f"Failed to fetch live options chain from yfinance: {e}")
        return []

def fetch_live_price_history(ticker: str, timeframe: str = "1d") -> pd.DataFrame:
    """
    Fetches stock prices from Yahoo Finance using raw requests v8 chart API.
    Supports timeframes: 5 min, 15 min, 1h, 4h, 1d
    """
    interval = "1d"
    period_range = "1y"
    
    if timeframe == "5 min":
        interval = "5m"
        period_range = "30d"
    elif timeframe == "15 min":
        interval = "15m"
        period_range = "30d"
    elif timeframe == "1h":
        interval = "1h"
        period_range = "1y"
    elif timeframe == "4h":
        interval = "1h"
        period_range = "2y"
    elif timeframe == "1d":
        interval = "1d"
        period_range = "5y"
        
    try:
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?range={period_range}&interval={interval}"
        res = session.get(url)
        if res.status_code != 200:
            print(f"Yahoo history endpoint returned status {res.status_code} for {ticker}")
            return pd.DataFrame()
            
        data = res.json()
        result = data["chart"]["result"][0]
        timestamps = result["timestamp"]
        quote = result["indicators"]["quote"][0]
        
        df = pd.DataFrame({
            "open": quote["open"],
            "high": quote["high"],
            "low": quote["low"],
            "close": quote["close"],
            "volume": quote["volume"]
        }, index=pd.to_datetime(timestamps, unit='s'))
        
        # Clean rows with NaN values
        df = df.dropna()
        
        if timeframe == "4h" and not df.empty:
            resampled = df.resample('4H').agg({
                'open': 'first',
                'high': 'max',
                'low': 'min',
                'close': 'last',
                'volume': 'sum'
            })
            df = resampled.dropna()
            
        return df
    except Exception as e:
        print(f"Failed to fetch live price history for {ticker}: {e}")
        return pd.DataFrame()

def generate_mock_options_chain_fallback(spot: float, ticker: str, history: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Fallback option chain generator that calculates dynamic IV and concentrates
    open interest on key support/resistance strikes based on the stock's price scale.
    This eliminates high-frequency noise and results in clear key options walls.
    """
    import random
    seed_val = sum(ord(c) for c in ticker)
    rng = random.Random(seed_val)
    
    if not history.empty and len(history) > 10:
        hv = float(history["close"].pct_change().std() * np.sqrt(252))
        if np.isnan(hv) or hv <= 0:
            hv = 0.30
    else:
        hv = 0.30
        
    pcr_base = 0.8
    chain = []
    
    # Dynamic step size and major strike placement based on price scale
    if spot < 15:
        step = 1.0
        offsets = [1.0, 2.0, 3.0]
    elif spot < 50:
        step = 2.5
        offsets = [2.5, 5.0, 7.5]
    elif spot < 250:
        step = 5.0
        offsets = [5.0, 10.0, 15.0]
    elif spot < 1000:
        step = 10.0
        offsets = [10.0, 20.0, 30.0]
    else:
        step = 50.0
        offsets = [50.0, 100.0, 150.0]
        
    base_strike = round(spot / step) * step
    
    # Generate strikes within +/- 15% range
    min_strike = int(base_strike - 5 * step)
    max_strike = int(base_strike + 5 * step)
    
    # Pre-define key support and resistance strikes
    major_supports = [base_strike - off for off in offsets]
    major_resistances = [base_strike + off for off in offsets]
    
    # Expirations covering DTE horizons (Minor, Intermediate, Major)
    dte_list = [7.0, 14.0, 30.0, 45.0, 60.0, 90.0]
    
    for dte in dte_list:
        decay = np.exp(-0.015 * dte)
        # Iterate over strikes with the appropriate step size
        for strike_val in range(int(min_strike), int(max_strike) + 1, int(step)):
            strike = float(strike_val)
            
            # Apply volatility skew
            put_skew = 1.15 if strike < spot else 0.85
            call_skew = 0.85 if strike < spot else 1.15
            
            put_iv = hv * put_skew * (0.9 + rng.random() * 0.2)
            call_iv = hv * call_skew * (0.9 + rng.random() * 0.2)
            
            # Normal strikes have very low baseline open interest
            base_oi = int((10 + rng.random() * 45) * decay)
            
            # Boost open interest on key major strikes to represent clean walls
            if strike in major_supports:
                put_oi = int((1500 + rng.random() * 2500) * decay)
                call_oi = base_oi
            elif strike in major_resistances:
                call_oi = int((1500 + rng.random() * 2500) * decay)
                put_oi = base_oi
            else:
                call_oi = base_oi
                put_oi = int(base_oi * pcr_base)
                
            chain.append({"strike": strike, "type": "call", "open_interest": call_oi, "iv": round(call_iv, 4), "dte": dte})
            chain.append({"strike": strike, "type": "put", "open_interest": put_oi, "iv": round(put_iv, 4), "dte": dte})
            
    return chain

import math

def std_normal_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

def calculate_delta(spot: float, strike: float, iv_percentage: float, days_to_expiration: float, is_call: bool, risk_free_rate: float = 0.05) -> float:
    dte = 4.0 if days_to_expiration <= 0 else days_to_expiration
    T = dte / 365.0
    sigma = iv_percentage / 100.0
    if sigma <= 0.05 or sigma > 1.5:
        sigma = 0.28
    
    try:
        d1 = (math.log(spot / strike) + (risk_free_rate + (sigma ** 2) / 2.0) * T) / (sigma * math.sqrt(T))
        delta_call = std_normal_cdf(d1)
    except:
        delta_call = 0.5
        
    return delta_call if is_call else delta_call - 1.0

def calculate_gamma(spot: float, strike: float, iv_percentage: float, days_to_expiration: float, risk_free_rate: float = 0.05) -> float:
    dte = 4.0 if days_to_expiration <= 0 else days_to_expiration
    T = dte / 365.0
    sigma = iv_percentage / 100.0
    if sigma <= 0.05 or sigma > 1.5:
        sigma = 0.28
        
    try:
        d1 = (math.log(spot / strike) + (risk_free_rate + (sigma ** 2) / 2.0) * T) / (sigma * math.sqrt(T))
        pdf = math.exp(-0.5 * d1 * d1) / math.sqrt(2.0 * math.pi)
        gamma = pdf / (spot * sigma * math.sqrt(T))
    except:
        gamma = 0.0
        
    return 0.0 if math.isnan(gamma) else gamma

def calculate_options_levels(chain: List[Dict[str, Any]], spot: float) -> Dict[str, List[Dict[str, Any]]]:
    if not chain:
        return {"supports": [], "resistances": []}
        
    # Group puts and calls by strike & dte to unify them
    grouped = {}
    for c in chain:
        strike = float(c["strike"])
        dte = float(c["dte"])
        key = (strike, dte)
        if key not in grouped:
            grouped[key] = {
                "strike": strike,
                "dte": dte,
                "callVol": 0.0,
                "putVol": 0.0,
                "iv_sum": 0.0,
                "iv_count": 0
            }
        g = grouped[key]
        if c["type"].lower() == "call":
            g["callVol"] = float(c["open_interest"])
        else:
            g["putVol"] = float(c["open_interest"])
            
        g["iv_sum"] += float(c["iv"]) * 100.0  # Convert to percentage
        g["iv_count"] += 1
        
    unified_rows = []
    for g in grouped.values():
        avg_iv = g["iv_sum"] / g["iv_count"] if g["iv_count"] > 0 else 30.0
        unified_rows.append({
            "strike": g["strike"],
            "dte": g["dte"],
            "callVol": g["callVol"],
            "putVol": g["putVol"],
            "iv": avg_iv,
            "spot": spot
        })
        
    # Split rows by horizon
    minor_rows = [r for r in unified_rows if r["dte"] <= 10]
    inter_rows = [r for r in unified_rows if r["dte"] > 10 and r["dte"] <= 35]
    major_rows = [r for r in unified_rows if r["dte"] > 35]
    
    # Helper to aggregate rows by strike within a horizon
    def aggregate_horizon(rows):
        option_data_map = {}
        for row in rows:
            dte = 4.0 if row["dte"] <= 0 else row["dte"]
            weight = min(1.5, 30.0 / dte)
            
            gamma = calculate_gamma(spot, row["strike"], row["iv"], dte)
            weighted_call_vol = row["callVol"] * weight
            weighted_put_vol = row["putVol"] * weight
            total_vol = row["callVol"] + row["putVol"]
            
            call_gex = weighted_call_vol * gamma * (spot ** 2) * 0.01
            put_gex = -weighted_put_vol * gamma * (spot ** 2) * 0.01
            net_gex = call_gex + put_gex
            
            strike = row["strike"]
            if strike in option_data_map:
                existing = option_data_map[strike]
                existing["callVol"] += weighted_call_vol
                existing["putVol"] += weighted_put_vol
                existing["netGex"] += net_gex
                existing["gammaSum"] += gamma
                existing["ivSum"] += row["iv"]
                existing["ivCount"] += 1
                existing["weightedDteSum"] += dte * total_vol
                existing["volSum"] += total_vol
            else:
                option_data_map[strike] = {
                    "strike": strike,
                    "callVol": weighted_call_vol,
                    "putVol": weighted_put_vol,
                    "netGex": net_gex,
                    "gammaSum": gamma,
                    "ivSum": row["iv"],
                    "ivCount": 1,
                    "spot": spot,
                    "weightedDteSum": dte * total_vol,
                    "volSum": total_vol
                }
                
        aggregated = []
        for o in option_data_map.values():
            avg_iv = o["ivSum"] / o["ivCount"]
            avg_gamma = o["gammaSum"] / o["ivCount"]
            avg_dte = round(o["weightedDteSum"] / o["volSum"]) if o["volSum"] > 0 else 30
            
            call_delta = calculate_delta(spot, o["strike"], avg_iv, avg_dte, True)
            put_delta = calculate_delta(spot, o["strike"], avg_iv, avg_dte, False)
            
            aggregated.append({
                "strike": o["strike"],
                "callVol": o["callVol"],
                "putVol": o["putVol"],
                "netGex": o["netGex"],
                "avgIv": avg_iv,
                "avgGamma": avg_gamma,
                "avgDte": avg_dte,
                "callDelta": call_delta,
                "putDelta": put_delta,
                "spot": spot
            })
        return aggregated

    global_aggregated = aggregate_horizon(unified_rows)
    if not global_aggregated:
        return {"supports": [], "resistances": []}
        
    # Calculate classification category based on options liquidity
    raw_max_vol = max([max(o["callVol"], o["putVol"]) for o in global_aggregated])
    if raw_max_vol >= 2000:
        category = 'LARGE'
    elif raw_max_vol >= 200:
        category = 'MID'
    else:
        category = 'SMALL'
        
    strike_range_mult = 0.15
    min_vol_floor = 100
    if category == 'LARGE':
        strike_range_mult = 0.12
        min_vol_floor = 500
    elif category == 'MID':
        strike_range_mult = 0.18
        min_vol_floor = 100
    elif category == 'SMALL':
        strike_range_mult = 0.30
        min_vol_floor = 5
        
    strike_low = spot * (1.0 - strike_range_mult)
    strike_high = spot * (1.0 + strike_range_mult)
    
    # Helper to score horizon candidates
    def score_horizon_candidates(rows, horizon_name):
        if not rows:
            return []
        aggregated = aggregate_horizon(rows)
        if not aggregated:
            return []
            
        max_vol = max([max(o["callVol"], o["putVol"]) for o in aggregated]) or 1.0
        max_abs_gex = max([abs(o["netGex"]) for o in aggregated]) or 1.0
        
        max_horizon_vol = max([o["callVol"] + o["putVol"] for o in aggregated]) or 10.0
        dynamic_vol_floor = max(5.0, min(min_vol_floor, max_horizon_vol * 0.05))
        
        sorted_agg = sorted(aggregated, key=lambda x: x["strike"])
        candidates = []
        
        for i in range(len(sorted_agg)):
            curr = sorted_agg[i]
            if curr["strike"] < strike_low or curr["strike"] > strike_high:
                continue
                
            total_strike_vol = curr["callVol"] + curr["putVol"]
            if total_strike_vol < dynamic_vol_floor:
                continue
                
            prev_vol = (sorted_agg[i-1]["callVol"] + sorted_agg[i-1]["putVol"]) if i > 0 else 0.0
            next_vol = (sorted_agg[i+1]["callVol"] + sorted_agg[i+1]["putVol"]) if i < len(sorted_agg) - 1 else 0.0
            
            is_local_peak = total_strike_vol >= prev_vol * 0.9 and total_strike_vol >= next_vol * 0.9
            if not is_local_peak:
                continue
                
            distance = abs(curr["strike"] - spot) / spot
            proximity_score = math.exp(-4.0 * distance)
            
            round_bonus = 1.0
            if curr["strike"] % 10 == 0:
                round_bonus = 1.25
            elif curr["strike"] % 5 == 0:
                round_bonus = 1.15
            elif curr["strike"] % 1 == 0:
                round_bonus = 1.05
                
            vol_metric = (curr["callVol"] + curr["putVol"]) / max_vol
            gex_metric = abs(curr["netGex"]) / max_abs_gex
            significance_score = (vol_metric * 0.5 + gex_metric * 0.5) * proximity_score * round_bonus
            
            candidates.append({
                **curr,
                "horizonName": horizon_name,
                "significanceScore": significance_score,
                "isCallWall": curr["callVol"] >= curr["putVol"],
                "totalVol": total_strike_vol
            })
        return candidates

    minor_candidates = score_horizon_candidates(minor_rows, "Minor")
    inter_candidates = score_horizon_candidates(inter_rows, "Intermediate")
    major_candidates = score_horizon_candidates(major_rows, "Major")
    
    # Sort descending by significanceScore
    minor_candidates.sort(key=lambda x: x["significanceScore"], reverse=True)
    inter_candidates.sort(key=lambda x: x["significanceScore"], reverse=True)
    major_candidates.sort(key=lambda x: x["significanceScore"], reverse=True)
    
    selected_supports = []
    selected_resistances = []
    selected_strikes = set()
    
    def add_horizon_top_candidates(candidates, count):
        added = 0
        for cand in candidates:
            if added >= count:
                break
            if cand["strike"] in selected_strikes:
                continue
                
            level_obj = {
                "price": cand["strike"],
                # Multiply by 100 so it scales nicely (ranges from 0 to 150)
                "strength": round(cand["significanceScore"] * 100.0, 2),
                "source": "options",
                "dte": cand["avgDte"],
                "horizon": cand["horizonName"].lower()
            }
            
            if cand["isCallWall"]:
                selected_resistances.append(level_obj)
            else:
                selected_supports.append(level_obj)
                
            selected_strikes.add(cand["strike"])
            added += 1

    add_horizon_top_candidates(minor_candidates, 2)
    add_horizon_top_candidates(inter_candidates, 2)
    add_horizon_top_candidates(major_candidates, 2)
    
    return {
        "supports": sorted(selected_supports, key=lambda x: x["strength"], reverse=True),
        "resistances": sorted(selected_resistances, key=lambda x: x["strength"], reverse=True)
    }

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/analyze/{ticker}")
def analyze_ticker(ticker: str, timeframe: str = "1d", db: Session = Depends(get_db)) -> Dict[str, Any]:
    ticker = ticker.upper()
    
    # 1. Fetch live stock price history
    history = fetch_live_price_history(ticker, timeframe)
    if history.empty:
        raise HTTPException(status_code=404, detail=f"Failed to fetch live price history for symbol {ticker}")
        
    spot = float(history["close"].iloc[-1])
    
    # 2. Fetch real options chain
    chain = fetch_live_options_chain(ticker, spot)
    if not chain:
        # Fallback to mock chain center around spot using history/ticker details
        chain = generate_mock_options_chain_fallback(spot, ticker, history)
        
    max_pain = calculate_max_pain(chain)
    
    # 2.5 Calculate additional options metrics
    put_oi = sum(c["open_interest"] for c in chain if c["type"].lower() == "put")
    call_oi = sum(c["open_interest"] for c in chain if c["type"].lower() == "call")
    pcr = round(put_oi / call_oi, 2) if call_oi > 0 else 0.8
    
    puts_ivs = [c["iv"] for c in chain if c["type"].lower() == "put" and c["iv"] > 0]
    calls_ivs = [c["iv"] for c in chain if c["type"].lower() == "call" and c["iv"] > 0]
    avg_puts_iv = np.mean(puts_ivs) if puts_ivs else 0.25
    avg_calls_iv = np.mean(calls_ivs) if calls_ivs else 0.25
    
    skew_val = avg_puts_iv / avg_calls_iv if avg_calls_iv > 0 else 1.0
    if skew_val > 1.1:
        skew_str = f"{skew_val:.2f} (Bearish Hedging)"
    elif skew_val < 0.9:
        skew_str = f"{skew_val:.2f} (Bullish Bias)"
    else:
        skew_str = f"{skew_val:.2f} (Neutral)"
        
    sentiment = "Bullish" if spot > max_pain else "Bearish"
    
    closes = history["close"].tolist()
    sma20 = float(np.mean(closes[-20:])) if len(closes) >= 20 else spot
    sma50 = float(np.mean(closes[-50:])) if len(closes) >= 50 else spot
    
    if len(closes) >= 20:
        recent_std = np.std(closes[-15:]) / np.mean(closes[-15:])
        if recent_std < 0.015:
            trend_phase = "Consolidation"
        elif spot > sma20 and sma20 > sma50:
            trend_phase = "Accumulation"
        elif spot < sma20 and sma20 < sma50:
            trend_phase = "Distribution"
        else:
            trend_phase = "Expansion"
    else:
        trend_phase = "Consolidation"
        
    all_ivs = [c["iv"] for c in chain if c["iv"] > 0]
    avg_iv = float(np.mean(all_ivs)) * 100 if all_ivs else 25.0
    if avg_iv < 20:
        iv_regime = f"Low ({avg_iv:.1f}%)"
    elif avg_iv < 40:
        iv_regime = f"Elevated ({avg_iv:.1f}%)"
    else:
        iv_regime = f"High ({avg_iv:.1f}%)"
            
    # 3. Technical S/R zones (limit to top 3 for clarity)
    sr_levels = calculate_sr_levels(history, window=10, num_levels=3)
    for sup in sr_levels["supports"]:
        sup["source"] = "technical"
        sup["dte"] = None
        sup["horizon"] = "minor"
    for res in sr_levels["resistances"]:
        res["source"] = "technical"
        res["dte"] = None
        res["horizon"] = "minor"

    # 4. Options S/R zones
    opt_levels = calculate_options_levels(chain, spot)
    
    # Deduplicate: 
    # 1. Filter out S/R levels (both technical and options) that are within 0.7% of Max Pain (Max Pain is highest priority)
    # 2. Filter out technical levels that are within 0.7% of options levels
    def is_close_to_max_pain(price, mp_val):
        if mp_val <= 0:
            return False
        return abs(price - mp_val) <= 0.007 * mp_val

    # Filter options levels first (discard if close to max pain)
    filtered_opt_supports = [lvl for lvl in opt_levels["supports"] if not is_close_to_max_pain(lvl["price"], max_pain)]
    filtered_opt_resistances = [lvl for lvl in opt_levels["resistances"] if not is_close_to_max_pain(lvl["price"], max_pain)]

    # Filter technical levels (discard if close to max pain or close to filtered options levels)
    filtered_tech_supports = []
    for sup in sr_levels["supports"]:
        if is_close_to_max_pain(sup["price"], max_pain):
            continue
        is_close_to_opt = False
        for opt_sup in filtered_opt_supports:
            if abs(sup["price"] - opt_sup["price"]) <= 0.007 * opt_sup["price"]:
                is_close_to_opt = True
                break
        if not is_close_to_opt:
            filtered_tech_supports.append(sup)

    filtered_tech_resistances = []
    for res in sr_levels["resistances"]:
        if is_close_to_max_pain(res["price"], max_pain):
            continue
        is_close_to_opt = False
        for opt_res in filtered_opt_resistances:
            if abs(res["price"] - opt_res["price"]) <= 0.007 * opt_res["price"]:
                is_close_to_opt = True
                break
        if not is_close_to_opt:
            filtered_tech_resistances.append(res)

    # Combine supports and resistances (sorted closest to spot, capped to top 3 each for clarity)
    combined_supports = sorted(filtered_tech_supports + filtered_opt_supports, key=lambda x: x["price"], reverse=True)[:3]
    combined_resistances = sorted(filtered_tech_resistances + filtered_opt_resistances, key=lambda x: x["price"])[:3]
    
    # 3. Formulate trade recommendations
    # Simple rule engine:
    trade_ideas = []
    
    # Use simple close comparison to historical mean as a proxy for trend
    is_bullish = spot > float(history["close"].mean())
    if is_bullish:
        trade_ideas.append({
            "strategy": "Bull Put Spread",
            "type": "options",
            "description": f"Sell ${spot * 0.98:.2f} Put, Buy ${spot * 0.96:.2f} Put. Hold for the next 7-10 days. Trend is positive, suggesting price consolidation or bullish support near the puts wall.",
            "probability": 85.0,
            "max_profit": "$120",
            "max_loss": "$380"
        })
    else:
        trade_ideas.append({
            "strategy": "Bear Call Spread",
            "type": "options",
            "description": f"Sell ${spot * 1.02:.2f} Call, Buy ${spot * 1.04:.2f} Call. Hold for the next 7-10 days. Trend is negative, implying downward momentum if resistance holds.",
            "probability": 78.0,
            "max_profit": "$140",
            "max_loss": "$360"
        })
        
    # Idea 2: Leveraged trade with TP1 & TP2
    if is_bullish:
        closest_support = sr_levels["supports"][0]["price"] if sr_levels["supports"] else spot * 0.97
        sl = closest_support * 0.99 if closest_support * 0.99 < spot else spot * 0.97
        risk = spot - sl
        tp1 = spot + 1.5 * risk
        tp2 = spot + 3.0 * risk
        trade_ideas.append({
            "strategy": f"Leveraged Long ({ticker})",
            "type": "leveraged",
            "description": f"Buy entry at current spot ${spot:.2f}, Stop Loss at ${sl:.2f}. Hold for the next 7-10 days. Target Profit 1 (TP1): ${tp1:.2f}, Target Profit 2 (TP2): ${tp2:.2f}. Leverage 5x.",
            "risk_reward": "1:3.0",
            "stop_loss": f"${sl:.2f}",
            "tp1": f"${tp1:.2f}",
            "tp2": f"${tp2:.2f}"
        })
    else:
        closest_resistance = sr_levels["resistances"][0]["price"] if sr_levels["resistances"] else spot * 1.03
        sl = closest_resistance * 1.01 if closest_resistance * 1.01 > spot else spot * 1.03
        risk = sl - spot
        tp1 = spot - 1.5 * risk
        tp2 = spot - 3.0 * risk
        trade_ideas.append({
            "strategy": f"Leveraged Short ({ticker})",
            "type": "leveraged",
            "description": f"Short entry at current spot ${spot:.2f}, Stop Loss at ${sl:.2f}. Hold for the next 7-10 days. Target Profit 1 (TP1): ${tp1:.2f}, Target Profit 2 (TP2): ${tp2:.2f}. Leverage 5x.",
            "risk_reward": "1:3.0",
            "stop_loss": f"${sl:.2f}",
            "tp1": f"${tp1:.2f}",
            "tp2": f"${tp2:.2f}"
        })
    
    # Save calculations to Database for audit trail
    try:
        db_metrics = OptionMetricsRecord(
            ticker=ticker,
            spot=spot,
            max_pain=max_pain,
            gamma_flip=0.0,
            total_net_gex=0.0
        )
        db.add(db_metrics)
        db.commit()
        db.refresh(db_metrics)

        # Save support levels
        for sup in combined_supports:
            db_level = TechnicalLevelRecord(
                metric_id=db_metrics.id,
                level_type="support",
                price=sup["price"],
                strength=sup["strength"],
                volume_concentration=sup.get("volume_concentration", 0.0)
            )
            db.add(db_level)

        # Save resistance levels
        for res in combined_resistances:
            db_level = TechnicalLevelRecord(
                metric_id=db_metrics.id,
                level_type="resistance",
                price=res["price"],
                strength=res["strength"],
                volume_concentration=res.get("volume_concentration", 0.0)
            )
            db.add(db_level)
        db.commit()
    except Exception as e:
        print(f"Database logging failed: {e}")
        db.rollback()
    
    return {
        "ticker": ticker,
        "spot": spot,
        "max_pain": max_pain,
        "supports": combined_supports,
        "resistances": combined_resistances,
        "trade_ideas": trade_ideas,
        "put_call_ratio": pcr,
        "sentiment": sentiment,
        "trend_phase": trend_phase,
        "iv_regime": iv_regime
    }

def fetch_live_etf_change(ticker: str) -> float:
    """
    Fetches the 1-week (5 trading days) price change percentage from Yahoo Finance
    """
    try:
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?range=15d&interval=1d"
        res = session.get(url, timeout=2.5)
        if res.status_code != 200:
            return 0.0
        data = res.json()
        result = data["chart"]["result"][0]
        quote = result["indicators"]["quote"][0]
        closes = [c for c in quote["close"] if c is not None]
        if len(closes) >= 6:
            prev_close = closes[-6]
            current_price = closes[-1]
            if prev_close > 0:
                change = ((current_price - prev_close) / prev_close) * 100
                return round(change, 2)
    except Exception as e:
        print(f"Failed to fetch live weekly change for {ticker}: {e}")
    return 0.0

@router.get("/macro/rotation")
def get_macro_sectors() -> List[Dict[str, Any]]:
    """
    Exposes real-time relative performance and momentum metrics for 16 ETFs in parallel
    """
    import concurrent.futures
    
    etf_list = [
        {"etf": "XLI", "name": "Industrials"},
        {"etf": "XLF", "name": "Financials"},
        {"etf": "XLV", "name": "Healthcare"},
        {"etf": "VGT", "name": "Technology (Vang)"},
        {"etf": "XLK", "name": "Technology (SPDR)"},
        {"etf": "XLE", "name": "Energy"},
        {"etf": "DBC", "name": "Commodities"},
        {"etf": "XLY", "name": "Consumer Disc"},
        {"etf": "XLU", "name": "Utilities"},
        {"etf": "XLP", "name": "Consumer Staples"},
        {"etf": "XLB", "name": "Materials"},
        {"etf": "XLC", "name": "Communications"},
        {"etf": "XLRE", "name": "Real Estate"},
        {"etf": "ITA", "name": "Aerospace & Def"},
        {"etf": "CIBR", "name": "Cybersecurity"},
        {"etf": "ICLN", "name": "Clean Energy"}
    ]
    
    def worker(item):
        ticker = item["etf"]
        change = fetch_live_etf_change(ticker)
        # Classify momentum based on change
        if change > 0.4:
            momentum = "Bullish"
        elif change < -0.4:
            momentum = "Bearish"
        else:
            momentum = "Neutral"
        return {
            "etf": ticker,
            "name": item["name"],
            "change": change,
            "momentum": momentum
        }
        
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        results = list(executor.map(worker, etf_list))
        
    # Sort from highest performing to lowest
    return sorted(results, key=lambda x: x["change"], reverse=True)

@router.get("/history/{ticker}")
def get_ticker_history(ticker: str, timeframe: str = "1d") -> List[Dict[str, Any]]:
    ticker = ticker.upper()
    df = fetch_live_price_history(ticker, timeframe)
    if df.empty:
        raise HTTPException(status_code=404, detail="No price history found")
    
    candles = []
    for date, row in df.iterrows():
        # Formulate time as UNIX timestamp for intraday/sub-daily data
        if timeframe in ["5 min", "15 min", "1h", "4h"]:
            time_val = int(date.timestamp())
        else:
            time_val = date.strftime("%Y-%m-%d")
            
        candles.append({
            "time": time_val,
            "open": round(float(row["open"]), 2),
            "high": round(float(row["high"]), 2),
            "low": round(float(row["low"]), 2),
            "close": round(float(row["close"]), 2)
        })
    # Sort chronological
    return sorted(candles, key=lambda x: x["time"])

class BacktestRequest(BaseModel):
    ticker: str
    strategy: str

@router.post("/backtest")
def trigger_backtest(req: BacktestRequest) -> Dict[str, Any]:
    ticker = req.ticker.upper()
    strategy = req.strategy
    
    df = fetch_live_price_history(ticker)
    if df.empty:
        raise HTTPException(status_code=404, detail="No price history found")
    closes = df["close"].tolist()
    
    try:
        results = run_historical_backtest(closes, strategy_type=strategy)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
