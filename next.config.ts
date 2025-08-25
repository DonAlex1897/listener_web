import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // required if you use next/image with static export
  },
};

export default nextConfig;
