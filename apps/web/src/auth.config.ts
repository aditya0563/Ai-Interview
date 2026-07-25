import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * Edge-compatible Auth.js configuration.
 * Must NOT import any Node.js-only modules (e.g. drizzle, postgres).
 * Used by both auth.ts (full server) and proxy.ts (Edge runtime).
 */
export const authConfig: NextAuthConfig = {
  providers: [GitHub],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnInterview = nextUrl.pathname.startsWith("/interview");
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");

      if (isOnAdmin) {
        return isLoggedIn && (auth?.user as { role?: string })?.role === "admin";
      }
      if (isOnInterview) {
        return isLoggedIn;
      }
      return true;
    },
  },
};

// Added default export so both named and default imports work seamlessly
export default authConfig;