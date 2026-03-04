import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    domains: [],
    remotePatterns: [],
  },
  trailingSlash: true,
};

export default nextConfig;
