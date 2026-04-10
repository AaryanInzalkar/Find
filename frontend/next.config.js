/** @type {import('next').NextConfig} */
const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/images/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
      },
    ],
  },
  experimental: {
    ppr: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  ...(standalone ? { output: "standalone" } : {}),
};

module.exports = nextConfig;
