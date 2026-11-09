import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Truecharts",
  description: "Options levels, volatility regime, 13F institutional flows and macro liquidity in one dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      style={{ fontSize: "85%" }}
    >
      <body className="min-h-full flex flex-col font-sans bg-[var(--bg)] text-[var(--fg)]">{children}</body>
    </html>
  );
}
