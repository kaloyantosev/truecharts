// Policy rates, Fed balance sheet, net liquidity (FRED) and COT positioning (CFTC),
// refreshed automatically by scripts/update_data.py. Do not edit the JSON by hand.
import data from "./macro.json";

export interface PolicyEvent { date: string; fed: string; label: string; type: string }
export interface CotRow { symbol: string; name: string; netCommPct: number; percentile: number; signal: string; reportDate: string }

export const MACRO = data as unknown as {
  asOf: string;
  source: string;
  rates: {
    fed: { value: string; date: string };
    ecb: { value: string; date: string; label: string };
    us10y: { value: string; date: string; label: string };
  };
  policyEvents: PolicyEvent[];
  spx: { points: [string, number][]; chg12m: number | null };
  liquidity: {
    fedAssetsT: number;
    fedAssets4wChangeB: number;
    fedAssetsDate: string;
    m2YoY: number;
    m2Date: string;
    netLiquidityT: number;
    netLiquidity13wPct: number;
    netLiquidityDate: string;
    spxCorr52w: number | null;
    regime: "Expanding" | "Contracting";
  };
  cot: CotRow[];
};
