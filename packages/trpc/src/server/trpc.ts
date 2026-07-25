import { initTRPC, TRPCError } from "@trpc/server";
import type { DB } from "@repo/database";

// ─── Session Types ─────────────────────────────────────────────────────────────
// Kept framework-agnostic (no next-auth import) so this package doesn't depend
// on apps/web. The actual auth() call lives in apps/web/src/server/context.ts.

export type SessionUser = {
  id: string;
  role: "user" | "admin";
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export type Context = {
  db: DB;
  session: { user: SessionUser } | null;
};

// ─── tRPC Initialisation ───────────────────────────────────────────────────────

const t = initTRPC.context<Context>().create();

// ─── Base building blocks ──────────────────────────────────────────────────────

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Open to everyone — no auth required. */
export const publicProcedure = t.procedure;

// ─── Auth Middleware ───────────────────────────────────────────────────────────

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to access this resource.",
    });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to access this resource.",
    });
  }
  if (ctx.session.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
    });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

// ─── Protected Procedures ──────────────────────────────────────────────────────

/** Requires an authenticated session. Throws UNAUTHORIZED otherwise. */
export const protectedProcedure = t.procedure.use(isAuthenticated);

/** Requires the authenticated user to have role = "admin". Throws FORBIDDEN otherwise. */
export const adminProcedure = t.procedure.use(isAdmin);
