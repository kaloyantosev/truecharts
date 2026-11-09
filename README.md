This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Data and updates

- **Live quotes** (ticker bar, watchlist, command palette, VIX strip): `/api/quotes`, Yahoo Finance chart data, delayed, cached 60 s.
- **13F institutional data** (`src/data/institutional.json`) and **macro data** (`src/data/macro.json`: Fed/ECB rates, US 10Y, Fed balance sheet, net liquidity, M2 from FRED; COT commercial positioning from the CFTC) are rebuilt by `scripts/update_data.py`. The GitHub Action *Refresh 13F, macro and COT data* runs it every Saturday and on weekdays during the 13F filing months (Feb, May, Aug, Nov), and commits only when the data changes.
- **Options levels** come from the backend's live options chain. If no chain is available, `/api/analyze` returns only technical levels with the options fields set to `null` and `options_source: "unavailable"`. Nothing is simulated.

Run the data refresh by hand:

```bash
pip install yfinance pandas
python scripts/update_data.py
```
