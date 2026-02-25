import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  // Prevent edge runtime issues with SQLite
  experimental: {},
};

export default nextConfig;
