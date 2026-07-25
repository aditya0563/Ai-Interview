import { db } from "@repo/database";
import type { Context } from "@repo/trpc/server";
import { auth } from "@/auth";

/**
 * Creates the tRPC request context.
 * Calls auth() to retrieve the current session (Node.js runtime only).
 * The session is passed into the tRPC context so protectedProcedure and
 * adminProcedure can enforce access control without touching the DB again.
 */
export async function createContext(): Promise<Context> {
  const session = await auth();
  return {
    db,
    session: session
      ? {
          user: {
            id: session.user.id,
            role: session.user.role,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image,
          },
        }
      : null,
  };
}
