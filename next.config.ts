import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  allowedDevOrigins: ["192.168.0.37", "192.168.0.141"],
};

export default nextConfig;
