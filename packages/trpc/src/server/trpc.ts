import { initTRPC } from "@trpc/server";
import type { DB } from "@repo/database";

export type Context = {
  db: DB;
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
