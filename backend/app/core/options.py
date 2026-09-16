import numpy as np
from scipy.stats import norm
from typing import List, Dict, Any, Optional

def black_scholes_gamma(S: float, K: float, t: float, sigma: float, r: float = 0.05) -> float:
    """
    Calculate the Black-Scholes option Gamma (second derivative of option price with respect to spot).
    S: Underlyer spot price
    K: Strike price
    t: Time to maturity in years (DTE / 365.0)
    sigma: Implied volatility (e.g. 0.20 for 20%)
    r: Risk-free interest rate
    """
    if t <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return 0.0
    
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * t) / (sigma * np.sqrt(t))
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(t))
    return float(gamma)

def calculate_gex_profile(spot: float, option_chain: List[Dict[str, Any]], r: float = 0.05) -> Dict[str, Any]:
    """
    Calculates GEX (Gamma Exposure) for each strike and total net GEX.
    option_chain: List of option contracts containing:
                  - strike: float
                  - type: str ("call" or "put")
                  - open_interest: int
                  - iv: float (implied volatility, e.g. 0.25)
                  - dte: float (days to expiration)
    """
    strikes_gex = {}
    total_gex = 0.0
    
    for contract in option_chain:
        strike = contract["strike"]
        option_type = contract["type"].lower()
        oi = contract["open_interest"]
        iv = contract["iv"]
        dte = contract["dte"]
        
        t = max(dte, 0.5) / 365.0  # floor DTE at 0.5 days to avoid division by zero
        gamma = black_scholes_gamma(spot, strike, t, iv, r)
        
        # Call GEX: Long Gamma position for market makers (assuming they are long calls)
        # Put GEX: Short Gamma position for market makers (assuming they are short puts)
        if option_type == "call":
            contract_gex = oi * gamma * 100 * spot
        elif option_type == "put":
            contract_gex = -oi * gamma * 100 * spot
        else:
            continue
            
        strikes_gex[strike] = strikes_gex.get(strike, 0.0) + contract_gex
        total_gex += contract_gex
        
    # Find the Gamma Flip zone (where GEX transitions from net positive to net negative)
    # Usually this is around the spot price. We can return sorted strike values
    sorted_gex = sorted([{"strike": k, "gex": v} for k, v in strikes_gex.items()], key=lambda x: x["strike"])
    
    return {
        "total_net_gex": total_gex,
        "strikes_gex": sorted_gex,
        "spot": spot
    }

def calculate_max_pain(option_chain: List[Dict[str, Any]], max_dte: Optional[float] = None, min_dte: Optional[float] = None) -> float:
    """
    Finds the Max Pain strike price (where option buyers lose the most money).
    Supports filtering by expiration horizon (e.g. Weekly <= 7 DTE or Monthly OPEX 15-45 DTE).
    """
    if not option_chain:
        return 0.0
        
    filtered = option_chain
    if max_dte is not None or min_dte is not None:
        subset = [
            c for c in option_chain 
            if (max_dte is None or c.get("dte", 0) <= max_dte) and (min_dte is None or c.get("dte", 0) >= min_dte)
        ]
        if subset:
            filtered = subset
            
    strikes = sorted(list(set(contract["strike"] for contract in filtered)))
    if not strikes:
        return 0.0
        
    min_pain = float("inf")
    max_pain_strike = strikes[0]
    
    for test_strike in strikes:
        total_pain = 0.0
        for contract in filtered:
            strike = contract["strike"]
            option_type = contract["type"].lower()
            oi = contract["open_interest"]
            
            if option_type == "call":
                # Value of calls at expiration if spot is test_strike
                total_pain += oi * max(test_strike - strike, 0)
            elif option_type == "put":
                # Value of puts at expiration if spot is test_strike
                total_pain += oi * max(strike - test_strike, 0)
                
        if total_pain < min_pain:
            min_pain = total_pain
            max_pain_strike = test_strike
            
    return float(max_pain_strike)

def calculate_gamma_flip(spot: float, option_chain: List[Dict[str, Any]], r: float = 0.05) -> float:
    """
    Finds the exact price where cumulative Net GEX transitions from positive to negative (Zero Gamma Root).
    Uses a fine-mesh root search around spot price.
    """
    if not option_chain or spot <= 0:
        return round(spot * 0.995, 2)
        
    def net_gex_at(eval_spot: float) -> float:
        net = 0.0
        for contract in option_chain:
            strike = contract["strike"]
            option_type = contract["type"].lower()
            oi = contract["open_interest"]
            iv = contract["iv"]
            dte = max(contract["dte"], 0.5)
            t = dte / 365.0
            
            g = black_scholes_gamma(eval_spot, strike, t, iv, r)
            if option_type == "call":
                net += oi * g * 100 * eval_spot
            elif option_type == "put":
                net -= oi * g * 100 * eval_spot
        return net

    # Scan test prices from -12% to +12% around spot
    steps = 100
    prices = np.linspace(spot * 0.88, spot * 1.12, steps)
    gex_vals = [net_gex_at(p) for p in prices]
    
    # Look for sign change
    for i in range(len(prices) - 1):
        if (gex_vals[i] <= 0 and gex_vals[i+1] > 0) or (gex_vals[i] >= 0 and gex_vals[i+1] < 0):
            # Linear interpolation for precise crossing
            p1, p2 = prices[i], prices[i+1]
            g1, g2 = gex_vals[i], gex_vals[i+1]
            if g2 != g1:
                flip = p1 - g1 * (p2 - p1) / (g2 - g1)
                return round(float(flip), 2)
                
    # If all positive or all negative, return the minimum absolute GEX price
    min_idx = int(np.argmin(np.abs(gex_vals)))
    return round(float(prices[min_idx]), 2)

def calculate_expected_move(spot: float, atm_iv: float, dte: float = 7.0) -> Dict[str, float]:
    """
    Computes McMillan's 1-standard deviation expected move envelope:
    Expected Move = Spot * IV * sqrt(DTE / 365)
    """
    if spot <= 0:
        return {"move": 0.0, "upper": 0.0, "lower": 0.0}
        
    sigma = atm_iv if atm_iv < 2.0 else atm_iv / 100.0  # handle decimal or percentage
    sigma = max(0.05, min(sigma, 2.5))
    t = max(0.5, dte) / 365.0
    
    move = spot * sigma * np.sqrt(t)
    return {
        "move": round(float(move), 2),
        "upper": round(float(spot + move), 2),
        "lower": round(float(spot - move), 2)
    }
