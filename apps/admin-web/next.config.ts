import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@armemosla/shared'],
  reactStrictMode: true,
};

export default nextConfig;
