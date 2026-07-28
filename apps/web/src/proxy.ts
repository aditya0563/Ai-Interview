import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// ─── Secrets ───────────────────────────────────────────────────────────────────
// These keys MUST remain strictly server-side and must NEVER be prefixed with
// NEXT_PUBLIC_. Exposing them to the browser would allow anyone to bypass the
// rate limiter and exhaust your Upstash quota.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Global IP Rate Limiter ────────────────────────────────────────────────────
// Generous sliding window: 100 requests per 10 seconds per IP.
// Acts as a DDoS shield before any request reaches the Node.js runtime.
const globalRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "10 s"),
  analytics: true,
  prefix: "ratelimit:global",
});

// ─── API Route Allowlist ───────────────────────────────────────────────────────
// Only /api/auth (NextAuth) and /api/trpc (our tRPC layer) are legitimate.
// Every other /api/* path is killed at the edge before reaching the runtime.
const ALLOWED_API_PREFIXES = ["/api/auth", "/api/trpc"] as const;

// ─── Auth.js Edge Guard ────────────────────────────────────────────────────────
const { auth } = NextAuth(authConfig);

// ─── Middleware Handler ────────────────────────────────────────────────────────
export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. API ROUTE SHIELDING ─────────────────────────────────────────────────────
  //    Evaluated first (no Upstash I/O) to save quota on invalid traffic.
  if (pathname.startsWith("/api/")) {
    const isAllowed = ALLOWED_API_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );
    if (!isAllowed) {
      return new NextResponse(null, {
        status: 403,
        statusText: "Forbidden",
      });
    }
  }

  // 2. GLOBAL IP RATE LIMITING ─────────────────────────────────────────────────
  //    Only reached by legitimate traffic. Uses the real client IP as the key.
  const ip = req.ip ?? "127.0.0.1";
  const { success } = await globalRatelimit.limit(ip);

  if (!success) {
    return new NextResponse(null, {
      status: 429,
      statusText: "Too Many Requests",
    });
  }

  // 3. AUTH.JS PAGE-LEVEL GUARD ────────────────────────────────────────────────
  //    Delegates to the existing Edge-compatible auth callback which enforces
  //    session checks for /interview/* and /admin/* routes.
  return auth(req as Parameters<typeof auth>[0]);
}

// ─── Matcher ───────────────────────────────────────────────────────────────────
// Intercepts all API routes (for shielding) and protected page routes (for auth).
// Excludes Next.js internals, static assets, and favicon to keep the edge function lean.
export const config = {
  matcher: [
    "/api/:path*",
    "/interview/:path*",
    "/admin/:path*",
  ],
};