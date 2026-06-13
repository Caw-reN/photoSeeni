import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "40.47.197.203",
    "192.168.0.254",
    "*.ngrok.io",
    "*.ngrok-free.app",
    "*.loca.lt",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "*.local",
      },
      {
        protocol: "http",
        hostname: "192.168.*",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:8000/api/:path*',
      },
      {
        source: '/storage/:path*',
        destination: 'http://backend:8000/storage/:path*',
      },
    ];
  },
};

export default nextConfig;
