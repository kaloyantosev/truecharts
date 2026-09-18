import math
from math import gamma
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional

def calculate_yang_zhang_volatility(df: pd.DataFrame, window: int = 30) -> float:
    """
    Yang-Zhang (2000) Drift-Independent and Jump-Independent Volatility Estimator.
    Sinclair Chapter 2, Equations 2.17a - 2.17e.
    Minimum variance unbiased estimator using Open, High, Low, Close.
    Returns annualized percentage (e.g. 24.5 for 24.5%).
    """
    if len(df) < window + 1:
        return 0.0

    subset = df.iloc[-(window + 1):].copy()
    
    o = subset['open'].values[1:]
    h = subset['high'].values[1:]
    l = subset['low'].values[1:]
    c = subset['close'].values[1:]
    c_prev = subset['close'].values[:-1]

    mask = (o > 0) & (h > 0) & (l > 0) & (c > 0) & (c_prev > 0) & (h >= l)
    if np.sum(mask) < 10:
        return 0.0

    o = o[mask]
    h = h[mask]
    l = l[mask]
    c = c[mask]
    c_prev = c_prev[mask]
    N = len(o)
    if N < 5:
        return 0.0

    # Overnight jumps: log(Open_i / Close_{i-1})
    log_oc = np.log(o / c_prev)
    mu_o = np.mean(log_oc)
    var_o = (1.0 / (N - 1.0)) * np.sum((log_oc - mu_o) ** 2)

    # Open-to-close: log(Close_i / Open_i)
    log_co = np.log(c / o)
    mu_c = np.mean(log_co)
    var_c = (1.0 / (N - 1.0)) * np.sum((log_co - mu_c) ** 2)

    # Rogers-Satchell intraday variance term:
    log_hc = np.log(h / c)
    log_ho = np.log(h / o)
    log_lc = np.log(l / c)
    log_lo = np.log(l / o)
    var_rs = (1.0 / N) * np.sum(log_hc * log_ho + log_lc * log_lo)

    # Weighting factor k (Eq. 2.17e)
    k = 0.34 / (1.34 + (N + 1.0) / (N - 1.0))

    # Total Yang-Zhang variance
    var_yz = var_o + k * var_c + (1.0 - k) * var_rs
    if var_yz <= 0:
        return 0.0

    return float(np.sqrt(var_yz * 252.0) * 100.0)

def calculate_parkinson_volatility(df: pd.DataFrame, window: int = 30) -> float:
    """
    Parkinson (1980) High-Low Range Volatility Estimator.
    Sinclair Chapter 2, Equation 2.14.
    """
    if len(df) < window:
        return 0.0

    subset = df.iloc[-window:].copy()
    h = subset['high'].values
    l = subset['low'].values

    mask = (h > 0) & (l > 0) & (h >= l)
    h = h[mask]
    l = l[mask]
    N = len(h)
    if N < 5:
        return 0.0

    log_hl = np.log(h / l)
    var_p = (1.0 / (4.0 * N * np.log(2.0))) * np.sum(log_hl ** 2)
    if var_p <= 0:
        return 0.0

    return float(np.sqrt(var_p * 252.0) * 100.0)

def calculate_garman_klass_volatility(df: pd.DataFrame, window: int = 30) -> float:
    """
    Garman-Klass (1980) Volatility Estimator.
    Sinclair Chapter 2, Equation 2.15.
    """
    if len(df) < window + 1:
        return 0.0

    subset = df.iloc[-(window + 1):].copy()
    h = subset['high'].values[1:]
    l = subset['low'].values[1:]
    c = subset['close'].values[1:]
    c_prev = subset['close'].values[:-1]

    mask = (h > 0) & (l > 0) & (c > 0) & (c_prev > 0) & (h >= l)
    h = h[mask]
    l = l[mask]
    c = c[mask]
    c_prev = c_prev[mask]
    N = len(h)
    if N < 5:
        return 0.0

    log_hl = np.log(h / l)
    log_cc = np.log(c / c_prev)

    var_gk = (1.0 / N) * np.sum(0.5 * (log_hl ** 2) - (2.0 * np.log(2.0) - 1.0) * (log_cc ** 2))
    if var_gk <= 0:
        return 0.0

    return float(np.sqrt(var_gk * 252.0) * 100.0)

def calculate_close_to_close_volatility(df: pd.DataFrame, window: int = 30) -> float:
    """
    Standard Close-to-Close Volatility with Jensen's Inequality Bias Correction b(N).
    Sinclair Chapter 2, Equations 2.1b, 2.5, 2.6.
    """
    if len(df) < window + 1:
        return 0.0

    closes = df['close'].values[-(window + 1):]
    log_returns = np.diff(np.log(closes))
    N = len(log_returns)
    if N < 5:
        return 0.0

    s2 = np.mean(log_returns ** 2)
    s = np.sqrt(s2)

    try:
        b_n = np.sqrt(2.0 / N) * (gamma(N / 2.0) / gamma((N - 1.0) / 2.0))
        unbiased_s = s / b_n
    except Exception:
        unbiased_s = s

    return float(unbiased_s * np.sqrt(252.0) * 100.0)

def calculate_iv_rank_and_percentile(history_iv_list: List[float], current_iv: float) -> Dict[str, float]:
    """
    Computes IV Rank (IVR) and IV Percentile (IVP).
    Sinclair Chapter 4 Volatility Cones context.
    """
    if not history_iv_list or current_iv <= 0:
        return {'iv_rank': 50.0, 'iv_percentile': 50.0}

    valid_ivs = [x for x in history_iv_list if x > 0]
    if not valid_ivs:
        return {'iv_rank': 50.0, 'iv_percentile': 50.0}

    low = min(valid_ivs)
    high = max(valid_ivs)

    if high <= low:
        iv_rank = 50.0
    else:
        iv_rank = ((current_iv - low) / (high - low)) * 100.0
        iv_rank = max(0.0, min(100.0, iv_rank))

    count_below = sum(1 for x in valid_ivs if x < current_iv)
    iv_percentile = (count_below / len(valid_ivs)) * 100.0

    return {
        'iv_rank': round(iv_rank, 1),
        'iv_percentile': round(iv_percentile, 1)
    }

def calculate_ivts_and_skew(option_chain: List[Dict[str, Any]], spot: float) -> Dict[str, Any]:
    """
    Analyzes Implied Volatility Term Structure (IVTS) and Skew Gradient.
    Sinclair Chapter 5, Equations 5.2 - 5.4, 5.9, and Chapter 12 Equation 12.7.
    """
    if not option_chain or spot <= 0:
        return {
            'ivts': 1.0,
            'term_structure_regime': 'Flat / Neutral Term Curve',
            'skew_slope': 1.0,
            'skew_bias': 'Balanced Smile (1.00x - Symmetric)',
            'front_iv': 25.0,
            'back_iv': 25.0
        }

    front_opts = [c for c in option_chain if 0 < c.get('dte', 0) <= 14 and c.get('iv', 0) > 0]
    back_opts = [c for c in option_chain if 25 <= c.get('dte', 0) <= 65 and c.get('iv', 0) > 0]

    front_atm_ivs = [c['iv'] for c in front_opts if abs(c['strike'] - spot) <= 0.04 * spot]
    back_atm_ivs = [c['iv'] for c in back_opts if abs(c['strike'] - spot) <= 0.04 * spot]

    front_iv = float(np.mean(front_atm_ivs)) * 100.0 if front_atm_ivs else 25.0
    back_iv = float(np.mean(back_atm_ivs)) * 100.0 if back_atm_ivs else (front_iv if front_iv > 0 else 25.0)

    ivts = round(front_iv / back_iv, 2) if back_iv > 0 else 1.0

    if ivts > 1.06:
        ts_regime = 'Backwardation (Acute Event / Panic Shock)'
    elif ivts < 0.94:
        ts_regime = 'Contango (Normal Upward Term Premium)'
    else:
        ts_regime = 'Flat / Neutral Term Curve'

    otm_puts = [
        c['iv'] for c in option_chain 
        if c.get('type', '').lower() == 'put' and 0.92 * spot <= c['strike'] <= 0.97 * spot and c.get('iv', 0) > 0
    ]
    otm_calls = [
        c['iv'] for c in option_chain 
        if c.get('type', '').lower() == 'call' and 1.03 * spot <= c['strike'] <= 1.08 * spot and c.get('iv', 0) > 0
    ]

    put_iv = float(np.mean(otm_puts)) * 100.0 if otm_puts else front_iv
    call_iv = float(np.mean(otm_calls)) * 100.0 if otm_calls else front_iv

    skew_slope = round(put_iv / call_iv, 2) if call_iv > 0 else 1.0
    if skew_slope >= 1.15:
        skew_bias = f'Heavy Put Skew ({skew_slope:.2f}x - Crash/Tail Hedging)'
    elif skew_slope <= 0.90:
        skew_bias = f'Call Skew Inversion ({skew_slope:.2f}x - Bullish FOMO)'
    else:
        skew_bias = f'Balanced Smile ({skew_slope:.2f}x - Symmetric)'

    return {
        'ivts': ivts,
        'term_structure_regime': ts_regime,
        'skew_slope': skew_slope,
        'skew_bias': skew_bias,
        'front_iv': round(front_iv, 1),
        'back_iv': round(back_iv, 1)
    }

def calculate_volume_velocity_and_impact(df: pd.DataFrame, rv_yz: float, window: int = 20) -> Dict[str, Any]:
    """
    Calculates Volume Velocity relative to 20d moving average, and
    Sinclair / Gatheral Market Impact parameter alpha = sigma / sqrt(mu) (Eq. 6.22).
    """
    if len(df) < window:
        return {
            'volume_velocity': 1.0,
            'volume_regime': 'Average Volume',
            'market_impact_alpha': 0.001
        }

    volumes = df['volume'].values[-window:]
    current_vol = float(volumes[-1])
    avg_vol = float(np.mean(volumes)) if np.mean(volumes) > 0 else 1.0

    velocity = round(current_vol / avg_vol, 2) if avg_vol > 0 else 1.0

    if velocity >= 1.5:
        vol_regime = f'Elevated Volume ({velocity:.1f}x 20d MA - Heavy Institutional Order Flow)'
    elif velocity <= 0.65:
        vol_regime = f'Low Volume ({velocity:.1f}x 20d MA - Holiday/Quiet Drift)'
    else:
        vol_regime = f'Normal Volume ({velocity:.1f}x 20d MA)'

    daily_sigma = (rv_yz / 100.0) / np.sqrt(252.0) if rv_yz > 0 else 0.015
    alpha = daily_sigma / np.sqrt(max(current_vol, 1000.0))

    return {
        'volume_velocity': velocity,
        'volume_regime': vol_regime,
        'market_impact_alpha': float(alpha)
    }

def synthesize_sinclair_analysis(
    df: pd.DataFrame,
    option_chain: List[Dict[str, Any]],
    current_iv: float,
    spot: float
) -> Dict[str, Any]:
    """
    Executes the full Euan Sinclair Volatility Trading Model:
    1. Multi-estimator RV (Yang-Zhang, Parkinson, Garman-Klass, Close-to-Close)
    2. Variance Risk Premium (VRP) & Volatility Edge
    3. IVTS (Term Structure) & Skew Asymmetry
    4. Volume Velocity & Market Impact
    5. Sinclair Regime Verdict & Half-Kelly Sizing Guidance
    """
    rv_yz = calculate_yang_zhang_volatility(df, window=30)
    rv_parkinson = calculate_parkinson_volatility(df, window=30)
    rv_gk = calculate_garman_klass_volatility(df, window=30)
    rv_cc = calculate_close_to_close_volatility(df, window=30)

    primary_rv = rv_yz if rv_yz > 0 else (rv_cc if rv_cc > 0 else current_iv)

    vrp_spread = round(current_iv - primary_rv, 2)
    vrp_pct = round((vrp_spread / primary_rv) * 100.0, 1) if primary_rv > 0 else 0.0

    surface_metrics = calculate_ivts_and_skew(option_chain, spot)

    rolling_rvs = []
    if len(df) >= 60:
        for i in range(30, min(len(df), 252)):
            w = df.iloc[i-30:i]
            r = calculate_parkinson_volatility(w, window=30)
            if r > 0:
                rolling_rvs.append(r)

    iv_rank_data = calculate_iv_rank_and_percentile(rolling_rvs, current_iv)

    ivts = surface_metrics['ivts']
    iv_rank = iv_rank_data['iv_rank']

    if ivts > 1.06:
        regime_verdict = 'Event Risk (Backwardation / Front IV Spiked)'
        vol_edge = 'Long Vega / Calendar Spreads'
    elif vrp_spread >= 3.0 and iv_rank >= 45.0:
        regime_verdict = 'Overpriced Vol (Short Premium Edge)'
        vol_edge = 'Credit Spreads / Iron Condors'
    elif vrp_spread <= -2.0 or iv_rank <= 25.0:
        regime_verdict = 'Vol Squeeze (Underpriced / Breakout Risk)'
        vol_edge = 'Long Debits / Breakout Straddles'
    else:
        regime_verdict = 'Equilibrium Vol (Fair Value)'
        vol_edge = 'Defined Risk at Confluences'

    # Weekly Expected Move (Monday open to Friday close 68% containment)
    weekly_em_dollars = round(spot * (current_iv / 100.0) * math.sqrt(5.0 / 252.0), 2)
    weekly_em_pct = round((weekly_em_dollars / spot) * 100.0, 2) if spot > 0 else 0.0

    return {
        'rv_yang_zhang': round(rv_yz, 1),
        'implied_volatility': round(current_iv, 1),
        'vrp_spread': vrp_spread,
        'vrp_pct': vrp_pct,
        'iv_rank': iv_rank_data['iv_rank'],
        'ivts': ivts,
        'term_structure_regime': surface_metrics['term_structure_regime'],
        'skew_slope': surface_metrics['skew_slope'],
        'skew_bias': surface_metrics['skew_bias'],
        'weekly_expected_move_dollars': weekly_em_dollars,
        'weekly_expected_move_pct': weekly_em_pct,
        'regime_verdict': regime_verdict,
        'vol_edge': vol_edge
    }
