import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Matches the 10MB cap enforced in src/lib/storage.ts (task
      // attachment uploads) — a little headroom above it for multipart
      // boundary/header overhead, per Next's own guidance.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
