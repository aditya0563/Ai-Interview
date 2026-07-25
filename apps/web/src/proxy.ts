import NextAuth from "next-auth";
import { authConfig } from "./auth.config"; 

/**
 * Next.js 16 Proxy (formerly Edge Middleware) powered by Auth.js.
 * Uses the Edge-compatible authConfig to protect routes before hitting the database.
 */

// Explicitly export the Auth.js function as the default export
export default NextAuth(authConfig).auth;

// Define which routes this proxy should intercept
export const config = {
  matcher: [
    "/interview/:path*",
    "/admin/:path*"
  ],
};