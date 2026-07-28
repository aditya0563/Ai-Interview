import { z } from "zod";
import { sql, eq } from "drizzle-orm";
import { users, interviews } from "@repo/database";
import { adminProcedure, router } from "../trpc";

export const adminRouter = router({
  getSystemStats: adminProcedure.query(async ({ ctx }) => {
    const [userCountResult] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    const [interviewCountResult] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(interviews);

    return {
      totalUsers: Number(userCountResult?.count || 0),
      totalInterviews: Number(interviewCountResult?.count || 0),
      systemHealth: "OK",
    };
  }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .delete(users)
        .where(eq(users.id, input.userId))
        .returning();
      
      return rows;
    }),
});
