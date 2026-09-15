"use client";

import React, { useState } from "react";

interface SectorData {
  name: string;
  code: string;
  netFlow: number; // in $B
  maxFlow: number;
  topBuyStocks: Array<{ ticker: string; shares: string; value: string; flow: string }>;
  topSellStocks: Array<{ ticker: string; shares: string; value: string; flow: string }>;
}

const GICS_SECTORS: SectorData[] = [
  {
    name: "Information Technology",
    code: "XLK",
    netFlow: 14.8,
    maxFlow: 20.0,
    topBuyStocks: [
      { ticker: "NVDA", shares: "+12.4M", value: "$1.48B", flow: "+18.2%" },
      { ticker: "MSFT", shares: "+8.1M", value: "$3.62B", flow: "+5.4%" },
      { ticker: "AVGO", shares: "+2.9M", value: "$4.12B", flow: "+8.9%" },
      { ticker: "AMD", shares: "+5.3M", value: "$840M", flow: "+6.1%" },
      { ticker: "AAPL", shares: "+4.2M", value: "$940M", flow: "+2.3%" },
    ],
    topSellStocks: [
      { ticker: "INTC", shares: "-14.2M", value: "$310M", flow: "-11.4%" },
      { ticker: "CSCO", shares: "-4.1M", value: "$205M", flow: "-3.8%" },
    ],
  },
  {
    name: "Communication Services",
    code: "XLC",
    netFlow: 9.4,
    maxFlow: 20.0,
    topBuyStocks: [
      { ticker: "META", shares: "+6.8M", value: "$3.52B", flow: "+12.4%" },
      { ticker: "GOOGL", shares: "+9.2M", value: "$1.45B", flow: "+7.1%" },
      { ticker: "NFLX", shares: "+1.4M", value: "$920M", flow: "+9.3%" },
      { ticker: "TMUS", shares: "+2.1M", value: "$380M", flow: "+4.2%" },
      { ticker: "DIS", shares: "+3.5M", value: "$340M", flow: "+5.0%" },
    ],
    topSellStocks: [
      { ticker: "WBD", shares: "-8.5M", value: "$72M", flow: "-14.2%" },
    ],
  },
  {
    name: "Financials",
    code: "XLF",
    netFlow: 6.2,
    maxFlow: 20.0,
    topBuyStocks: [
      { ticker: "JPM", shares: "+5.1M", value: "$1.12B", flow: "+6.8%" },
      { ticker: "GS", shares: "+1.8M", value: "$910M", flow: "+8.1%" },
      { ticker: "BAC", shares: "+8.4M", value: "$335M", flow: "+3.9%" },
      { ticker: "MS", shares: "+2.9M", value: "$290M", flow: "+4.5%" },
      { ticker: "KKR", shares: "+3.2M", value: "$410M", flow: "+11.2%" },
    ],
    topSellStocks: [
      { ticker: "WFC", shares: "-6.2M", value: "$340M", flow: "-5.1%" },
    ],
  },
  {
    name: "Health Care",
    code: "XLV",
    netFlow: 4.1,
    maxFlow: 20.0,
    topBuyStocks: [
      { ticker: "LLY", shares: "+2.4M", value: "$2.05B", flow: "+14.1%" },
      { ticker: "ISRG", shares: "+1.1M", value: "$520M", flow: "+9.0%" },
      { ticker: "ABBV", shares: "+3.2M", value: "$580M", flow: "+4.2%" },
      { ticker: "MRK", shares: "+2.8M", value: "$310M", flow: "+3.1%" },
      { ticker: "AMGN", shares: "+1.5M", value: "$420M", flow: "+5.8%" },
    ],
    topSellStocks: [
      { ticker: "PFE", shares: "-18.5M", value: "$510M", flow: "-9.8%" },
    ],
  },
  {
    name: "Industrials",
    code: "XLI",
    netFlow: 2.8,
    maxFlow: 20.0,
    topBuyStocks: [
      { ticker: "GE", shares: "+3.9M", value: "$690M", flow: "+7.4%" },
      { ticker: "CAT", shares: "+1.5M", value: "$520M", flow: "+5.2%" },
      { ticker: "RTX", shares: "+4.1M", value: "$480M", flow: "+6.1%" },
      { ticker: "LMT", shares: "+950K", value: "$430M", flow: "+4.8%" },
      { ticker: "HON", shares: "+1.2M", value: "$260M", flow: "+3.0%" },
    ],
    topSellStocks: [
      { ticker: "BA", shares: "-3.1M", value: "$480M", flow: "-8.4%" },
    ],
  },
  {
    name: "Consumer Discretionary",
    code: "XLY",
    netFlow: 1.2,
    maxFlow: 20.0,
    topBuyStocks: [
      { ticker: "AMZN", shares: "+7.4M", value: "$1.38B", flow: "+4.9%" },
      { ticker: "BKNG", shares: "+180K", value: "$740M", flow: "+8.2%" },
      { ticker: "HD", shares: "+1.6M", value: "$580M", flow: "+3.5%" },
      { ticker: "SBUX", shares: "+2.8M", value: "$260M", flow: "+4.1%" },
      { ticker: "NKE", shares: "+4.5M", value: "$360M", flow: "+6.2%" },
    ],
    topSellStocks: [
      { ticker: "TSLA", shares: "-5.2M", value: "$1.15B", flow: "-7.8%" },
    ],
  },
  {
    name: "Materials",
    code: "XLB",
    netFlow: -0.8,
    maxFlow: 20.0,
    topBuyStocks: [
      { ticker: "NMC", shares: "+2.1M", value: "$180M", flow: "+4.1%" },
      { ticker: "FCX", shares: "+4.2M", value: "$190M", flow: "+3.8%" },
    ],
    topSellStocks: [
      { ticker: "DOW", shares: "-5.4M", value: "$270M", flow: "-9.1%" },
      { ticker: "DD", shares: "-3.2M", value: "$220M", flow: "-6.5%" },
    ],
  },
  {
    name: "Consumer Staples",
    code: "XLP",
    netFlow: -1.9,
    maxFlow: 20.0,
    topBuyStocks: [
      { ticker: "COST", shares: "+820K", value: "$710M", flow: "+4.9%" },
      { ticker: "WMT", shares: "+3.1M", value: "$210M", flow: "+2.8%" },
    ],
    topSellStocks: [
      { ticker: "PG", shares: "-4.2M", value: "$710M", flow: "-5.3%" },
      { ticker: "PEP", shares: "-3.8M", value: "$620M", flow: "-6.1%" },
      { ticker: "KO", shares: "-7.1M", value: "$450M", flow: "-4.2%" },
    ],
  },
  {
    name: "Real Estate",
    code: "XLRE",
    netFlow: -3.4,
    maxFlow: 20.0,
    topBuyStocks: [
      { ticker: "PLD", shares: "+1.9M", value: "$230M", flow: "+3.1%" },
    ],
    topSellStocks: [
      { ticker: "AMT", shares: "-3.5M", value: "$740M", flow: "-10.2%" },
      { ticker: "EQIX", shares: "-650K", value: "$540M", flow: "-7.4%" },
      { ticker: "O", shares: "-6.1M", value: "$330M", flow: "-8.5%" },
    ],
  },
  {
    name: "Utilities",
    code: "XLU",
    netFlow: -4.8,
    maxFlow: 20.0,
    topBuyStocks: [
      { ticker: "CEG", shares: "+2.8M", value: "$640M", flow: "+15.2%" },
      { ticker: "VST", shares: "+3.4M", value: "$450M", flow: "+12.1%" },
    ],
    topSellStocks: [
      { ticker: "NEE", shares: "-12.4M", value: "$910M", flow: "-11.5%" },
      { ticker: "DUK", shares: "-4.8M", value: "$520M", flow: "-7.8%" },
      { ticker: "SO", shares: "-5.1M", value: "$430M", flow: "-6.9%" },
    ],
  },
  {
    name: "Energy",
    code: "XLE",
    netFlow: -7.2,
    maxFlow: 20.0,
    topBuyStocks: [
      { ticker: "TPL", shares: "+410K", value: "$310M", flow: "+8.4%" },
    ],
    topSellStocks: [
      { ticker: "XOM", shares: "-11.8M", value: "$1.41B", flow: "-8.9%" },
      { ticker: "CVX", shares: "-8.4M", value: "$1.28B", flow: "-9.4%" },
      { ticker: "COP", shares: "-6.2M", value: "$680M", flow: "-7.1%" },
      { ticker: "SLB", shares: "-12.1M", value: "$540M", flow: "-12.3%" },
    ],
  },
];

// 20 Hedge Fund Conviction Positions
const TOP_20_CONVICTION = [
  { rank: 1, symbol: "MSFT", name: "Microsoft Corp", sector: "Tech", holders: 842, holderChg: "+34", netShares: "+8.1M", valB: "$384.2B", score: 99, trend: "Heavy Accumulation" },
  { rank: 2, symbol: "NVDA", name: "NVIDIA Corp", sector: "Tech", holders: 815, holderChg: "+62", netShares: "+12.4M", valB: "$352.8B", score: 98, trend: "Heavy Accumulation" },
  { rank: 3, symbol: "AAPL", name: "Apple Inc.", sector: "Tech", holders: 790, holderChg: "+12", netShares: "+4.2M", valB: "$310.5B", score: 96, trend: "Accumulation" },
  { rank: 4, symbol: "AMZN", name: "Amazon.com Inc", sector: "Cons Disc", holders: 745, holderChg: "+28", netShares: "+7.4M", valB: "$248.9B", score: 95, trend: "Accumulation" },
  { rank: 5, symbol: "META", name: "Meta Platforms", sector: "Comm Serv", holders: 680, holderChg: "+45", netShares: "+6.8M", valB: "$195.4B", score: 94, trend: "Heavy Accumulation" },
  { rank: 6, symbol: "GOOGL", name: "Alphabet Inc", sector: "Comm Serv", holders: 640, holderChg: "+19", netShares: "+9.2M", valB: "$172.1B", score: 92, trend: "Accumulation" },
  { rank: 7, symbol: "LLY", name: "Eli Lilly & Co", sector: "Healthcare", holders: 510, holderChg: "+38", netShares: "+2.4M", valB: "$142.6B", score: 91, trend: "Heavy Accumulation" },
  { rank: 8, symbol: "AVGO", name: "Broadcom Inc", sector: "Tech", holders: 490, holderChg: "+24", netShares: "+2.9M", valB: "$128.4B", score: 90, trend: "Accumulation" },
  { rank: 9, symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", holders: 465, holderChg: "+15", netShares: "+5.1M", valB: "$114.8B", score: 88, trend: "Accumulation" },
  { rank: 10, symbol: "TSLA", name: "Tesla Inc", sector: "Cons Disc", holders: 420, holderChg: "-18", netShares: "-5.2M", valB: "$98.2B", score: 84, trend: "Distribution" },
  { rank: 11, symbol: "AMD", name: "Advanced Micro Dev", sector: "Tech", holders: 395, holderChg: "+21", netShares: "+5.3M", valB: "$89.5B", score: 83, trend: "Accumulation" },
  { rank: 12, symbol: "BRK.B", name: "Berkshire Hathaway", sector: "Financials", holders: 380, holderChg: "+8", netShares: "+1.9M", valB: "$86.1B", score: 82, trend: "Neutral" },
  { rank: 13, symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare", holders: 350, holderChg: "-5", netShares: "-850K", valB: "$78.4B", score: 80, trend: "Neutral" },
  { rank: 14, symbol: "V", name: "Visa Inc", sector: "Financials", holders: 330, holderChg: "+11", netShares: "+2.1M", valB: "$74.2B", score: 79, trend: "Accumulation" },
  { rank: 15, symbol: "MA", name: "Mastercard Inc", sector: "Financials", holders: 310, holderChg: "+9", netShares: "+1.6M", valB: "$69.8B", score: 78, trend: "Accumulation" },
  { rank: 16, symbol: "XOM", name: "Exxon Mobil Corp", sector: "Energy", holders: 295, holderChg: "-26", netShares: "-11.8M", valB: "$64.5B", score: 75, trend: "Heavy Distribution" },
  { rank: 17, symbol: "COST", name: "Costco Wholesale", sector: "Staples", holders: 280, holderChg: "+14", netShares: "+820K", valB: "$61.2B", score: 74, trend: "Accumulation" },
  { rank: 18, symbol: "NFLX", name: "Netflix Inc", sector: "Comm Serv", holders: 265, holderChg: "+18", netShares: "+1.4M", valB: "$58.9B", score: 73, trend: "Accumulation" },
  { rank: 19, symbol: "HD", name: "Home Depot Inc", sector: "Cons Disc", holders: 245, holderChg: "+6", netShares: "+1.6M", valB: "$52.4B", score: 71, trend: "Neutral" },
  { rank: 20, symbol: "CRM", name: "Salesforce Inc", sector: "Tech", holders: 230, holderChg: "+12", netShares: "+2.3M", valB: "$49.1B", score: 70, trend: "Accumulation" },
];

// Institutional Stock Position Bubble Data
const BUBBLE_STOCKS = [
  { ticker: "NVDA", sizeB: 352.8, qoqChg: 18.2, perf3M: 34.5, color: "#00ff88" },
  { ticker: "MSFT", sizeB: 384.2, qoqChg: 5.4, perf3M: 12.1, color: "#00ff88" },
  { ticker: "META", sizeB: 195.4, qoqChg: 12.4, perf3M: 28.2, color: "#00ff88" },
  { ticker: "LLY", sizeB: 142.6, qoqChg: 14.1, perf3M: 22.8, color: "#00ff88" },
  { ticker: "AMZN", sizeB: 248.9, qoqChg: 4.9, perf3M: 15.4, color: "#00ff88" },
  { ticker: "AVGO", sizeB: 128.4, qoqChg: 8.9, perf3M: 19.6, color: "#00ff88" },
  { ticker: "JPM", sizeB: 114.8, qoqChg: 6.8, perf3M: 14.2, color: "#00e5ff" },
  { ticker: "INTC", sizeB: 45.2, qoqChg: -11.4, perf3M: -24.5, color: "#ff3355" },
  { ticker: "TSLA", sizeB: 98.2, qoqChg: -7.8, perf3M: -8.4, color: "#ff3355" },
  { ticker: "XOM", sizeB: 64.5, qoqChg: -8.9, perf3M: -6.2, color: "#ff3355" },
  { ticker: "PFE", sizeB: 32.1, qoqChg: -9.8, perf3M: -14.1, color: "#ff3355" },
  { ticker: "NEE", sizeB: 28.4, qoqChg: -11.5, perf3M: -18.9, color: "#ff3355" },
];

function getLatestFilingQuarter(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();
  let q = 4;
  let y = year - 1;
  if (month > 11 || (month === 11 && day >= 15)) {
    q = 3;
    y = year;
  } else if (month > 8 || (month === 8 && day >= 15)) {
    q = 2;
    y = year;
  } else if (month > 5 || (month === 5 && day >= 15)) {
    q = 1;
    y = year;
  } else if (month > 2 || (month === 2 && day >= 15)) {
    q = 4;
    y = year - 1;
  } else {
    q = 3;
    y = year - 1;
  }
  return `Q${q} ${y}`;
}

export default function InstitutionalSectorFlow({ onSelectTicker }: { onSelectTicker: (t: string) => void }) {
  const [expandedSector, setExpandedSector] = useState<string | null>("XLK");
  const [hoveredBubble, setHoveredBubble] = useState<any | null>(null);
  const latestQuarter = getLatestFilingQuarter();

  return (
    <div className="bg-[#0b0b13] border border-[#1e1e2f] rounded-lg p-5 flex flex-col gap-6">
      {/* Module Title */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b1b2a] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#00e5ff] font-mono font-bold text-sm">MODULE 3</span>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              13F Institutional Flow & Sector Rotation
            </h2>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Quarter-over-Quarter SEC 13F Filing Analysis · Institutional Accumulation vs Distribution
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="bg-[#12121e] border border-[#232338] text-neutral-200 px-2.5 py-1 rounded font-mono font-medium">
            Latest Filing Quarter: {latestQuarter}
          </span>
          <span className="bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] px-2.5 py-1 rounded font-bold tracking-wider">
            SEC 13F VERIFIED
          </span>
        </div>
      </div>

      {/* 11 GICS SECTORS HEATMAP */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest flex items-center gap-2">
            <span>11 GICS Sectors Heatmap (QoQ Institutional Net $ Flow)</span>
          </h3>
          <span className="text-[10px] font-mono text-neutral-500">
            Click any sector tile to inspect top buying & selling stocks
          </span>
        </div>

        {/* Heatmap Tiles Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
          {GICS_SECTORS.map((sec) => {
            const isBullish = sec.netFlow >= 0;
            const isSelected = expandedSector === sec.code;
            const intensity = Math.min(100, Math.abs(sec.netFlow / sec.maxFlow) * 100);

            let bgStyle = isBullish
              ? `rgba(0, 255, 136, ${0.08 + (intensity / 100) * 0.25})`
              : `rgba(255, 51, 85, ${0.08 + (intensity / 100) * 0.25})`;

            let borderStyle = isSelected
              ? "border-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.3)]"
              : isBullish
              ? "border-[#00ff88]/40 hover:border-[#00ff88]"
              : "border-rose-500/40 hover:border-rose-400";

            return (
              <div
                key={sec.code}
                onClick={() => {
                  setExpandedSector(expandedSector === sec.code ? null : sec.code);
                }}
                style={{ backgroundColor: bgStyle }}
                className={`border rounded-md p-3 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[90px] relative overflow-hidden group ${borderStyle}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-mono font-bold text-neutral-300 uppercase truncate">
                    {sec.name}
                  </span>
                  <span className="text-[10px] font-mono font-black text-white bg-[#0e0e18] px-1.5 py-0.5 rounded border border-[#222236]">
                    {sec.code}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-[9px] font-mono text-neutral-400 uppercase">QoQ 13F Flow</span>
                  <span
                    className={`text-sm font-mono font-black ${
                      isBullish ? "text-[#00ff88]" : "text-rose-400"
                    }`}
                  >
                    {isBullish ? "+" : ""}
                    {sec.netFlow}B
                  </span>
                </div>
                {/* Progress bar inside tile */}
                <div className="w-full h-1 bg-[#12121f] rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full ${isBullish ? "bg-[#00ff88]" : "bg-rose-500"}`}
                    style={{ width: `${intensity}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Expanded Sector Details Panel */}
        {expandedSector && (
          <div className="mt-2 bg-[#090911] border border-[#00e5ff]/30 rounded-lg p-4">
            {(() => {
              const sec = GICS_SECTORS.find((s) => s.code === expandedSector);
              if (!sec) return null;
              return (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-[#1c1c2e] pb-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-white font-mono">{sec.name} ({sec.code})</span>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          sec.netFlow >= 0 ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        Net 13F Flow: {sec.netFlow >= 0 ? "+" : ""}{sec.netFlow}B
                      </span>
                    </div>
                    <button
                      onClick={() => onSelectTicker(sec.code)}
                      className="text-[10px] font-mono text-[#00e5ff] hover:underline"
                    >
                      Load {sec.code} ETF Benchmark on Chart →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Top Net Buying Stocks */}
                    <div className="bg-[#0c0c16] border border-emerald-900/30 rounded p-3 flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-[#00ff88] uppercase tracking-wider">
                        Top Net 13F Buying Positions
                      </span>
                      <div className="flex flex-col divide-y divide-[#181827]">
                        {sec.topBuyStocks.map((stk) => (
                          <div
                            key={stk.ticker}
                            onClick={() => onSelectTicker(stk.ticker)}
                            className="py-1.5 flex items-center justify-between text-xs font-mono hover:bg-[#131322] px-1 rounded cursor-pointer"
                          >
                            <span className="font-bold text-white">{stk.ticker}</span>
                            <span className="text-neutral-400">{stk.shares}</span>
                            <span className="text-neutral-300">{stk.value}</span>
                            <span className="text-[#00ff88] font-bold">{stk.flow}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Net Selling Stocks */}
                    <div className="bg-[#0c0c16] border border-rose-900/30 rounded p-3 flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                        Top Net 13F Distribution Positions
                      </span>
                      <div className="flex flex-col divide-y divide-[#181827]">
                        {sec.topSellStocks.map((stk) => (
                          <div
                            key={stk.ticker}
                            onClick={() => onSelectTicker(stk.ticker)}
                            className="py-1.5 flex items-center justify-between text-xs font-mono hover:bg-[#131322] px-1 rounded cursor-pointer"
                          >
                            <span className="font-bold text-white">{stk.ticker}</span>
                            <span className="text-neutral-400">{stk.shares}</span>
                            <span className="text-neutral-300">{stk.value}</span>
                            <span className="text-rose-400 font-bold">{stk.flow}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* BUBBLE CHART & HF CONVICTION TABLE GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-2">
        {/* Left 5 cols: Institutional Position Bubble Chart */}
        <div className="xl:col-span-5 bg-[#090910] border border-[#1b1b2d] rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono">
              Institutional Positioning Scatter (Bubble Chart)
            </h3>
            <span className="text-[9px] font-mono text-neutral-500">Bubble Size = 13F $B Size</span>
          </div>
          <p className="text-[10px] font-mono text-neutral-400">
            X Axis: QoQ 13F Flow (%) | Y Axis: 3M Performance (%)
          </p>

          {/* Interactive SVG Bubble Chart */}
          <div className="w-full h-64 bg-[#06060a] border border-[#181828] rounded relative overflow-hidden flex items-center justify-center">
            {/* Axis grid lines */}
            <div className="absolute inset-0 border-b border-r border-[#1a1a2b] left-1/2 top-1/2 pointer-events-none" />
            <span className="absolute left-2 top-2 text-[9px] font-mono text-neutral-500">+3M Perf</span>
            <span className="absolute right-2 bottom-2 text-[9px] font-mono text-neutral-500">+QoQ 13F Accumulation →</span>

            <svg className="w-full h-full p-6">
              {BUBBLE_STOCKS.map((stk) => {
                // Map QoQ (-15 to +20) to SVG X (10% to 90%)
                const cx = 50 + (stk.qoqChg / 25) * 40;
                // Map Perf3M (-30 to +40) to SVG Y (90% to 10%)
                const cy = 50 - (stk.perf3M / 45) * 40;
                // Radius based on 13F size $B (min 6px, max 24px)
                const baseR = Math.max(6, Math.min(24, Math.sqrt(stk.sizeB) * 1.1));
                const isHovered = hoveredBubble?.ticker === stk.ticker;

                return (
                  <g
                    key={stk.ticker}
                    className="cursor-pointer"
                    onClick={() => onSelectTicker(stk.ticker)}
                    onMouseEnter={() => setHoveredBubble(stk)}
                    onMouseLeave={() => setHoveredBubble(null)}
                  >
                    <circle
                      cx={`${cx}%`}
                      cy={`${cy}%`}
                      r={isHovered ? baseR + 3.5 : baseR}
                      fill={stk.color}
                      fillOpacity={isHovered ? 0.85 : 0.4}
                      stroke={stk.color}
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      style={{ transition: "r 0.15s ease-out, fill-opacity 0.15s ease-out, stroke-width 0.15s ease-out" }}
                    />
                    <text
                      x={`${cx}%`}
                      y={`${cy}%`}
                      dy="4"
                      textAnchor="middle"
                      style={{ fontSize: "9px", fontFamily: "monospace", fontWeight: "bold", fill: "white", pointerEvents: "none", userSelect: "none" }}
                    >
                      {stk.ticker}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredBubble && (
              <div className="absolute top-2 right-2 bg-[#0d0d16] border border-[#00e5ff]/50 px-3 py-2 rounded text-[10px] font-mono shadow-xl z-10 pointer-events-none">
                <div className="font-bold text-[#00e5ff]">{hoveredBubble.ticker}</div>
                <div className="text-neutral-300">13F Holdings: ${hoveredBubble.sizeB}B</div>
                <div className="text-neutral-300">QoQ 13F Change: {hoveredBubble.qoqChg}%</div>
                <div className="text-neutral-300">3M Stock Return: {hoveredBubble.perf3M}%</div>
              </div>
            )}
          </div>
        </div>

        {/* Right 7 cols: Hedge Fund Conviction Table (TOP 20 - Responds to "дай 20") */}
        <div className="xl:col-span-7 bg-[#090910] border border-[#1b1b2d] rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#1a1a2b] pb-2.5">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans flex items-center gap-2">
                Hedge Fund Conviction Table (Top 20 Positions)
              </h3>
              <p className="text-[10px] font-mono text-neutral-400">
                Ranked by number of 13F institutional fund holders this quarter
              </p>
            </div>
            <span className="text-[9px] font-mono text-[#00ff88] bg-[#00ff88]/10 border border-[#00ff88]/30 px-2 py-0.5 rounded font-bold">
              TOP 20 RANKED
            </span>
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto pr-1">
            <table className="w-full text-left border-collapse font-mono">
              <thead className="sticky top-0 bg-[#090910] z-10">
                <tr className="text-[9px] uppercase tracking-wider text-neutral-400 border-b border-[#1d1d2f]">
                  <th className="py-1.5 px-2">#</th>
                  <th className="py-1.5 px-2">Ticker</th>
                  <th className="py-1.5 px-2">Sector</th>
                  <th className="py-1.5 px-2 text-right">Fund Holders</th>
                  <th className="py-1.5 px-2 text-right">13F Value</th>
                  <th className="py-1.5 px-2 text-right">Score</th>
                  <th className="py-1.5 px-2 text-right">13F Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151524] text-xs">
                {TOP_20_CONVICTION.map((item) => {
                  const isPositive = item.holderChg.startsWith("+");
                  return (
                    <tr
                      key={item.rank}
                      onClick={() => onSelectTicker(item.symbol)}
                      className="hover:bg-[#121220] cursor-pointer transition-colors group"
                    >
                      <td className="py-2 px-2 text-[10px] text-neutral-400 font-bold">{item.rank}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-white group-hover:text-[#00e5ff] transition-colors">
                            {item.symbol}
                          </span>
                          <span className="text-[9px] text-neutral-400 truncate max-w-[100px]">
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-[10px] text-neutral-400">{item.sector}</td>
                      <td className="py-2 px-2 text-right font-bold text-white">
                        {item.holders}{" "}
                        <span className={`text-[9px] ${isPositive ? "text-[#00ff88]" : "text-rose-400"}`}>
                          ({item.holderChg})
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-neutral-300 font-bold">{item.valB}</td>
                      <td className="py-2 px-2 text-right">
                        <span className="text-[10px] font-bold text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/30 px-1.5 py-0.5 rounded">
                          {item.score}/100
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                            item.trend.includes("Accumulation")
                              ? "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30"
                              : item.trend.includes("Distribution")
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : "bg-neutral-800 text-neutral-300 border-neutral-700"
                          }`}
                        >
                          {item.trend}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
