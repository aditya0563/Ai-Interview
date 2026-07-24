import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { interviews } from "@repo/database";
import { publicProcedure, router } from "../trpc";

export const interviewsRouter = router({
  create: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        jobRole: z.string().min(1),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.db
        .insert(interviews)
        .values({
          userId: input.userId,
          jobRole: input.jobRole,
        })
        .returning();
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => {
      return ctx.db
        .select()
        .from(interviews)
        .where(eq(interviews.id, input.id));
    }),

  addTranscriptMessage: publicProcedure
    .input(
      z.object({
        interviewId: z.string().uuid(),
        message: z.object({
          role: z.string(),
          content: z.string(),
        }),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.db
        .update(interviews)
        .set({
          // Append to the jsonb array using PostgreSQL's || operator
          transcript: sql`${interviews.transcript} || ${JSON.stringify([input.message])}::jsonb`,
        })
        .where(eq(interviews.id, input.interviewId))
        .returning();
    }),

  updateStatus: publicProcedure
    .input(
      z.object({
        interviewId: z.string().uuid(),
        status: z.enum(["active", "completed"]),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.db
        .update(interviews)
        .set({ status: input.status })
        .where(eq(interviews.id, input.interviewId))
        .returning();
    }),
});
