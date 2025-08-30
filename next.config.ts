import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['redis']
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'node:crypto': 'commonjs node:crypto'
      });
    }
    return config;
  }
};

export default nextConfig;
