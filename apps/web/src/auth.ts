import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@repo/database/client";
import { accounts, sessions, users, verificationTokens } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "admin";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role?: "user" | "admin";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    /**
     * Runs when a JWT is created or updated.
     * On first sign-in (user object is present), we fetch the user's role
     * from the DB and persist it in the token so every subsequent request
     * doesn't need a DB round-trip.
     */
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: fetch full user row to get the role.
        const dbUser = await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.id, user.id!))
          .then((rows) => rows[0]);

        token.id = dbUser?.id ?? user.id!;
        token.role = dbUser?.role ?? "user";
      }
      return token;
    },

    /**
     * Exposes id and role on session.user so client code can read them
     * without an additional API call.
     */
    session({ session, token }) {
      if (token) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.role = token.role === "admin" ? "admin" : "user";
      }
      return session;
    },
  },
});
