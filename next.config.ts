import type { NextConfig } from "next";

const uploadBodySizeLimit = "100mb";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    domains: [],
    remotePatterns: [],
  },
  experimental: {
    middlewareClientMaxBodySize: uploadBodySizeLimit,
  },
  trailingSlash: true,
};

export default nextConfig;
