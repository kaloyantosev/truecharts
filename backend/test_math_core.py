import numpy as np
import pandas as pd
from app.core.options import black_scholes_gamma, calculate_gex_profile, calculate_max_pain
from app.core.sr_zones import calculate_sr_levels

def test_options_math():
    print("Testing Options Math...")
    # Validate Black-Scholes Gamma
    # Ref inputs: S=100, K=100, t=30/365, sigma=0.20
    gamma = black_scholes_gamma(100.0, 100.0, 30.0/365.0, 0.20)
    print(f"BS Gamma (Spot=100, Strike=100, DTE=30, IV=20%): {gamma:.6f}")
    assert gamma > 0, "Gamma must be positive for non-expired options"
    
    # Mock Option Chain
    mock_chain = [
        {"strike": 95.0, "type": "call", "open_interest": 1000, "iv": 0.22, "dte": 10.0},
        {"strike": 100.0, "type": "call", "open_interest": 5000, "iv": 0.20, "dte": 10.0},
        {"strike": 105.0, "type": "call", "open_interest": 2000, "iv": 0.21, "dte": 10.0},
        {"strike": 95.0, "type": "put", "open_interest": 3000, "iv": 0.23, "dte": 10.0},
        {"strike": 100.0, "type": "put", "open_interest": 4000, "iv": 0.20, "dte": 10.0},
        {"strike": 105.0, "type": "put", "open_interest": 1500, "iv": 0.22, "dte": 10.0},
    ]
    
    # Calculate GEX
    gex_result = calculate_gex_profile(100.0, mock_chain)
    print(f"Total Net GEX: {gex_result['total_net_gex']:.2f}")
    
    # Calculate Max Pain
    max_pain = calculate_max_pain(mock_chain)
    print(f"Calculated Max Pain: {max_pain}")
    assert max_pain == 100.0, f"Max pain should be 100.0, got {max_pain}"

def test_sr_math():
    print("\nTesting S/R Math...")
    # Generate mock price data (sine wave + noise)
    np.random.seed(42)
    t = np.linspace(0, 10, 100)
    # Price oscillating between ~95 and ~105
    prices = 100.0 + 5.0 * np.sin(t) + np.random.normal(0, 0.2, 100)
    
    df = pd.DataFrame({
        "open": prices - 0.1,
        "high": prices + 0.3,
        "low": prices - 0.3,
        "close": prices,
        "volume": np.random.randint(1000, 5000, 100)
    })
    
    sr_result = calculate_sr_levels(df, window=5, bandwidth_pct=0.01)
    
    print("Supports detected:")
    for sup in sr_result["supports"]:
        print(f"  Price: {sup['price']} (Strength: {sup['strength']:.4f})")
        
    print("Resistances detected:")
    for res in sr_result["resistances"]:
        print(f"  Price: {res['price']} (Strength: {res['strength']:.4f})")
        
    assert len(sr_result["supports"]) > 0 or len(sr_result["resistances"]) > 0, "Should detect levels"

if __name__ == "__main__":
    test_options_math()
    test_sr_math()
    print("\nAll math core unit tests passed successfully!")
