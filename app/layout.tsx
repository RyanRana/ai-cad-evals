import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CAD-Bench — research-grade evaluation of AI CAD agents",
  description:
    "An open benchmark for AI CAD agents. 308 prompts across 20 categories in 4 layers (geometry, engineering, manufacturing, cognition), scored with bootstrap CIs, 2PL IRT ability θ, worst-case p5, and a (capability, cost) Pareto frontier.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col">
        {/* Preprint-style top strip */}
        <div className="border-b border-[var(--border)] bg-[var(--background-2)]">
          <div className="max-w-6xl mx-auto px-6 h-7 flex items-center justify-between text-[10px] font-mono tracking-[0.18em] uppercase text-[var(--muted)]">
            <span>Preprint · cad-bench/v0.5 · sweep 2026-04-12</span>
            <span className="hidden md:inline">sha256: 7af1·9c0e·b21f · seed 42 · n=308</span>
            <span>open · MIT</span>
          </div>
        </div>

        <header className="border-b sticky top-0 z-30 bg-[var(--background)]/90 backdrop-blur">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-baseline gap-3">
              <span
                className="inline-block w-2 h-2 align-middle"
                style={{ background: "var(--accent)" }}
              />
              <span className="font-serif text-[20px] leading-none tracking-tight">
                CAD<span className="text-[var(--muted-2)]">·</span>Bench
              </span>
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--muted)]">
                v0.5
              </span>
            </Link>
            <nav className="flex items-center gap-7 text-[13px] text-[var(--foreground)]/85">
              <Link href="/" className="hover:text-[var(--accent)]">Leaderboard</Link>
              <Link href="/categories" className="hover:text-[var(--accent)]">Categories</Link>
              <Link href="/tasks" className="hover:text-[var(--accent)]">Tasks</Link>
              <Link href="/agents" className="hover:text-[var(--accent)]">Agents</Link>
              <Link href="/design" className="hover:text-[var(--accent)]">Design</Link>
              <Link href="/methodology" className="hover:text-[var(--accent)]">Methodology</Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 relative z-10">
          {children}
        </main>

        <footer className="border-t mt-20">
          <div className="max-w-6xl mx-auto px-6 py-6 grid sm:grid-cols-3 gap-4 text-[11px] text-[var(--muted)] font-mono">
            <div>
              <div className="text-[var(--foreground)]/80">CAD-Bench Lab · 2026</div>
              <div>open evaluation harness · MIT</div>
            </div>
            <div>
              <div className="text-[var(--foreground)]/80">Cite</div>
              <div>cad-bench/v0.5 (2026), commit 7af19c0e</div>
            </div>
            <div className="sm:text-right">
              <div className="text-[var(--foreground)]/80">Reproduce</div>
              <div>git clone · pnpm i · pnpm bench</div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
