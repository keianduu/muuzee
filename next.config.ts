import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep `next dev` artifacts separate from `next build`. Running a production
  // build while the local Admin is open must not invalidate its CSS chunks.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
