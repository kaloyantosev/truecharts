import numpy as np
from scipy.stats import norm
from typing import List, Dict, Any

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

def calculate_max_pain(option_chain: List[Dict[str, Any]]) -> float:
    """
    Finds the Max Pain strike price (where option buyers lose the most money).
    """
    if not option_chain:
        return 0.0
        
    strikes = sorted(list(set(contract["strike"] for contract in option_chain)))
    min_pain = float("inf")
    max_pain_strike = strikes[0] if strikes else 0.0
    
    for test_strike in strikes:
        total_pain = 0.0
        for contract in option_chain:
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
