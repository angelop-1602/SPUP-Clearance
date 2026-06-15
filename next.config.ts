import type { NextConfig } from "next";

const uploadBodySizeLimit = "50mb";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
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
};

export default nextConfig;
