// Types for tc_engine.js (the shared engine; the same file runs inside TradingView via the desktop injector).

export interface EngineLadderRow {
  strike: number;
  put_oi: number;
  call_oi: number;
  put_vol?: number;
  call_vol?: number;
}

export interface EngineInput {
  ticker: string;
  open: number;
  spot?: number;
  atr?: number;
  daily?: number[][]; // prior sessions [o, h, l, c], oldest first
  iv: number | null; // vol index prior close / 100
  prevDay?: { h: number; l: number; c: number };
  weekly: EngineLadderRow[];
  zdte: EngineLadderRow[];
  bars?: number[][]; // today's 5m bars so far [t, o, h, l, c]
  extra?: { price: number; label: string; color?: string }[];
  preOpen?: boolean;
}

export interface EngineLevel {
  price: number;
  label: string;
  color: string;
  kind: string;
  side: "res" | "sup";
  distAtr: number;
  pTouch?: number | null;
  pHoldClose?: number | null;
  touched?: boolean;
}

export interface EngineOutput {
  version: string;
  ticker: string;
  calibrated: boolean;
  error?: string;
  gammaFlip?: number | null;
  gfDistAtr?: number | null;
  regime?: string;
  regimeStats?: { n: number; range_atr: number; range_atr_p80: number; trend_day: number; up: number; gap_fill: number; real_vs_impl: number } | null;
  gapAtr?: number | null;
  expectedRange?: { atr: number; dollars: number; p80Dollars: number };
  reach?: { k: number[]; up: number[]; down: number[] };
  levels: EngineLevel[];
  scenario?: { code: string; title: string; lines: string[] };
  notes: string[];
}

declare const TCEngine: {
  VERSION: string;
  analyze(input: EngineInput): EngineOutput;
  atr14(daily: number[][]): number | null;
  gammaFlip(ladder: EngineLadderRow[], iv: number, T: number, ref: number): { flip: number | null; gex: number };
};
export default TCEngine;
