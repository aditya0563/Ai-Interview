import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@repo/ui", "@repo/trpc", "@repo/database"],
  // Monaco Editor relies on Web Workers. Exclude it from server-side
  // bundling so Next.js only ships it as a client-side chunk.
  serverExternalPackages: ["monaco-editor"],
};

export default nextConfig;
