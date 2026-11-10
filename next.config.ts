import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image runs `node .next/standalone/server.js`, which needs the
  // standalone output. Local `npm start` uses plain `next start`, which warns
  // if standalone is enabled — so it is opt-in via the build environment.
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  experimental: {
    serverActions: {
      // Item photos can be a few MB each.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
