import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['@sparticuz/chromium'],
  outputFileTracingIncludes: {
    '/api/scrape': ['./node_modules/@sparticuz/chromium/bin/**/*'],
    '/api/accounts/validate-session': ['./node_modules/@sparticuz/chromium/bin/**/*'],
  },
};

export default nextConfig;
