import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/ui", "@repo/trpc", "@repo/database"],
  // Monaco Editor relies on Web Workers. Exclude it from server-side
  // bundling so Next.js only ships it as a client-side chunk.
  serverExternalPackages: ["monaco-editor"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
