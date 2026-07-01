import type { NextConfig } from "next";
import path from "path";
import { loadEnv } from "./lib/server/envLoader";
loadEnv();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fix: suppress workspace root warning
  outputFileTracingRoot: path.join(__dirname),
  // Redirect old /dashboard to main AI Command Center
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/",
        permanent: true,
      },
    ];
  },

  // Fix: add headers so ngrok browser interstitial is bypassed
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "ngrok-skip-browser-warning", value: "true" },
        ],
      },
    ];
  },

  // Fix: Disable filesystem cache in dev to avoid OneDrive EBUSY/UNKNOWN file-locking crashes
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
