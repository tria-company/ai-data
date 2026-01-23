import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['@sparticuz/chromium'],
  // @ts-ignore
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/@sparticuz/chromium/bin/**/*'],
    },
  },
};

export default nextConfig;
