import { initTRPC, TRPCError } from "@trpc/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
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

// ─── Logger Middleware ─────────────────────────────────────────────────────────

const loggerMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = performance.now();
  const result = await next();
  const end = performance.now();
  const durationMs = end - start;

  const logData = {
    severity: durationMs > 1500 ? "WARN" : "INFO",
    path,
    type,
    status: result.ok ? "ok" : "error",
    durationMs: Number(durationMs.toFixed(2)),
    userId: ctx.session?.user.id,
  };

  console.log(JSON.stringify(logData));

  return result;
});

/** Open to everyone — no auth required. */
export const publicProcedure = t.procedure.use(loggerMiddleware);

// ─── Auth Middleware ───────────────────────────────────────────────────────────

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to access this resource.",
    });
  }
  return next({
    ctx: {
      session: {
        ...ctx.session,
        user: ctx.session.user,
      },
    },
  });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
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
  return next({
    ctx: {
      session: {
        ...ctx.session,
        user: ctx.session.user,
      },
    },
  });
});

// ─── Protected Procedures ──────────────────────────────────────────────────────

/** Requires an authenticated session. Throws UNAUTHORIZED otherwise. */
export const protectedProcedure = t.procedure.use(isAuthed);

/** Requires the authenticated user to have role = "admin". Throws FORBIDDEN otherwise. */
export const adminProcedure = t.procedure.use(isAdmin);

// ─── Upstash Redis & Rate Limiter ──────────────────────────────────────────────

const redis = Redis.fromEnv();

/**
 * Sliding-window rate limiter: 5 requests per 10 seconds per user.
 * Protects metered Gemini AI endpoints from Denial-of-Wallet attacks.
 */
const aiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "10 s"),
  analytics: true,
  prefix: "ratelimit:ai",
});

// ─── Rate Limiting Middleware ──────────────────────────────────────────────────

/**
 * Must be chained AFTER isAuthed so the context is already narrowed:
 * ctx.session.user.id is guaranteed to be a non-nullable string here.
 */
const isRateLimited = t.middleware(async ({ ctx, next }) => {
  // Type is narrowed by the preceding isAuthed middleware —
  // no optional chaining or non-null assertions required.
  const identifier = (ctx as { session: { user: { id: string } } }).session
    .user.id;

  const { success } = await aiRatelimit.limit(identifier);

  if (!success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "Rate limit exceeded for AI requests. Please slow down.",
    });
  }

  return next();
});

// ─── AI Procedure ──────────────────────────────────────────────────────────────

/**
 * Requires an authenticated session AND passes the per-user sliding-window
 * rate limit (5 req / 10 s). Use this for every Gemini-backed endpoint.
 */
export const aiProcedure = protectedProcedure.use(isRateLimited);

