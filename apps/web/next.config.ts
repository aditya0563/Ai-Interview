import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/ui", "@repo/trpc", "@repo/database"],
};

export default nextConfig;
