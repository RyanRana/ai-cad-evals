import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CAD-Bench — research-grade evaluation of AI CAD agents",
  description:
    "An open benchmark for AI CAD agents. 308 prompts across 20 categories in 4 layers (geometry, engineering, manufacturing, cognition), scored with bootstrap CIs, 2PL IRT ability θ, worst-case p5, and a (capability, cost) Pareto frontier.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">
        <header className="border-b sticky top-0 z-30 bg-[var(--background)]/85 backdrop-blur">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="font-mono text-sm tracking-tight">
              <span className="inline-block w-1.5 h-1.5 bg-current align-middle mr-2" />
              CAD-Bench<span className="text-[var(--muted)]">/v0.5</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/" className="hover:underline underline-offset-4">Leaderboard</Link>
              <Link href="/categories" className="hover:underline underline-offset-4">Categories</Link>
              <Link href="/tasks" className="hover:underline underline-offset-4">Tasks</Link>
              <Link href="/agents" className="hover:underline underline-offset-4">Agents</Link>
              <Link href="/design" className="hover:underline underline-offset-4">Design</Link>
              <Link href="/methodology" className="hover:underline underline-offset-4">Methodology</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">{children}</main>
        <footer className="border-t mt-16">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between text-xs text-[var(--muted)]">
            <span className="font-mono">CAD-Bench v0.5 · sweep 2026-04-12 · seed 42 · n=308</span>
            <span>open evaluation harness · MIT</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
