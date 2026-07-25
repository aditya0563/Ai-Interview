import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Next.js Edge Proxy powered by Auth.js.
 * Uses the Edge-compatible authConfig to protect routes before hitting the database.
 */

// Export the Auth.js handler as default
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/interview/:path*",
    "/admin/:path*",
  ],
};