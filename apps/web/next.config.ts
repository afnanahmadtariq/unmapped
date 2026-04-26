import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // In a pnpm monorepo the lockfile lives at the workspace root, not inside
  // apps/web. Turbopack auto-detects the root via pnpm-lock.yaml and expands
  // its module resolution scope accordingly.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
