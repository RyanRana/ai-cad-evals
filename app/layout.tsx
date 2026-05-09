import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CAD-Bench",
  description: "An open benchmark for AI CAD agents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen flex flex-col bg-white text-[var(--foreground)]">
        <header className="border-b border-[var(--border)]">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="text-[15px] font-medium tracking-tight">
              CAD-Bench
            </Link>
            <nav className="flex items-center gap-6 text-[14px] text-[var(--muted)]">
              <Link href="/" className="hover:text-[var(--foreground)]">Leaderboard</Link>
              <Link href="/playground" className="hover:text-[var(--foreground)]">Playground</Link>
              <Link href="/docs" className="hover:text-[var(--foreground)]">Documentation</Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12">
          {children}
        </main>

        <footer className="border-t border-[var(--border)] mt-16">
          <div className="max-w-5xl mx-auto px-6 py-6 text-[12px] text-[var(--muted)]">
            CAD-Bench · open evaluation harness · MIT
          </div>
        </footer>
      </body>
    </html>
  );
}
