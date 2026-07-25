import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Next.js Edge Middleware powered by Auth.js.
 * Uses the Edge-compatible authConfig (no Node.js imports) so this file
 * can run in the Vercel/Next.js Edge runtime.
 *
 * Route protection is handled by the `authorized` callback in auth.config.ts:
 *   - /interview/** → must be authenticated
 *   - /admin/**    → must be authenticated AND role === "admin"
 *
 * Unauthenticated/unauthorised users are redirected to the sign-in page
 * configured in authConfig.pages.signIn ("/").
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/interview/:path*",
    "/admin/:path*",
  ],
};
