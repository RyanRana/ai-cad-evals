// CAD-Bench Vercel project configuration.
// Static Next.js site (App Router, all 67 pages prerender). No serverless
// functions, no env vars required at build time. The eval runner under
// scripts/ is a CLI workflow only; it never executes at request time.
import { routes, type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "npm run build",
  installCommand: "npm install",
  // Site is static — long cache lives on the immutable `_next/static` tree;
  // `/refs` reference assets are also content-hashed, treat them as immutable.
  headers: [
    routes.cacheControl("/_next/static/(.*)", {
      public: true,
      maxAge: "1 year",
      immutable: true,
    }),
    routes.cacheControl("/refs/(.*)", {
      public: true,
      maxAge: "1 day",
    }),
    // Send a strict referrer policy on every other route.
    {
      source: "/(.*)",
      headers: [
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    },
  ],
};

export default config;
