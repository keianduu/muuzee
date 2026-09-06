import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep `next dev` artifacts separate from `next build`. Running a production
  // build while the local Admin is open must not invalidate its CSS chunks.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // The Admin has several routes that stay open while data is reviewed. Next's
  // short development defaults can dispose an inactive route, leaving an open
  // tab to request a stale chunk when navigation resumes. Keep the local route
  // set warm for a working session; this option only affects `next dev`.
  onDemandEntries: {
    maxInactiveAge: 12 * 60 * 60 * 1000,
    pagesBufferLength: 32,
  },
};

export default nextConfig;
