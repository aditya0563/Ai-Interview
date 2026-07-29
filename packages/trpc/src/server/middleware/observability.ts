import * as Sentry from "@sentry/nextjs";
import { logger } from "@repo/logger";
import { t } from "../trpc-instance"; // We will extract t to a separate file or import from trpc

// Assuming t is passed in or imported. 
// Since trpc.ts exports t.middleware, we can just define it as a standard function that takes t.
export const createObservabilityMiddleware = (t: any) => {
  return t.middleware(async ({ path, type, next, ctx }: any) => {
    const start = performance.now();
    const result = await next();
    const durationMs = Number((performance.now() - start).toFixed(2));

    const logData = {
      path,
      type,
      status: result.ok ? "ok" : "error",
      durationMs,
      userId: ctx.session?.user?.id,
    };

    if (result.ok) {
      if (durationMs > 1500) {
        logger.warn(logData, "Slow tRPC request detected");
      } else {
        logger.info(logData, "tRPC request completed");
      }
    } else {
      logger.error({ ...logData, error: result.error.message, stack: result.error.stack }, "tRPC request failed");

      // Capture unhandled 500 errors to Sentry
      if (result.error.code === "INTERNAL_SERVER_ERROR") {
        Sentry.withScope((scope) => {
          scope.setTag("trpc.path", path);
          scope.setTag("trpc.type", type);
          if (ctx.session?.user) {
            scope.setUser({ id: ctx.session.user.id });
          }
          Sentry.captureException(result.error);
        });
      }
    }

    return result;
  });
};
