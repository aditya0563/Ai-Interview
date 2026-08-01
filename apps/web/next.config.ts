import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/ui", "@repo/trpc", "@repo/database"],
  // Monaco Editor relies on Web Workers. Exclude it from server-side
  // bundling so Next.js only ships it as a client-side chunk.
  serverExternalPackages: ["monaco-editor"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default withSentryConfig(nextConfig, {
  autoInstrumentMiddleware: false,
});
