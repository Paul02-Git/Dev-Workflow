import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Matches the 10MB cap enforced in src/lib/storage.ts (task
      // attachment uploads) — a little headroom above it for multipart
      // boundary/header overhead, per Next's own guidance.
      bodySizeLimit: "11mb",
    },
    // lucide-react, date-fns, and react-icons are all tree-shaken by Next
    // automatically already (its own default optimizePackageImports list).
    // @hugeicons/core-free-icons is a large barrel package (thousands of
    // icon exports) imported by name across 8 shared UI primitives
    // (sidebar, sheet, dropdown-menu, select, dialog, breadcrumb...) that
    // render on nearly every page — not in Next's default list, so without
    // this it's on the bundler to prove the unused exports are safe to
    // drop rather than Next rewriting the imports to per-icon paths itself.
    optimizePackageImports: ["@hugeicons/react", "@hugeicons/core-free-icons"],
  },
};

export default nextConfig;
