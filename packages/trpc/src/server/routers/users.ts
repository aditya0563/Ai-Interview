import { eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "@repo/database";
import { publicProcedure, router } from "../trpc";

export const usersRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(users);
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => {
      return ctx.db.select().from(users).where(eq(users.id, input.id));
    }),

  create: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1).optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.insert(users).values(input).returning();
    }),
});
