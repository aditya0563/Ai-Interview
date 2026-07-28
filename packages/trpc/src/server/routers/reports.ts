import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { reports, interviews } from "@repo/database";
import { protectedProcedure, router } from "../trpc";

export const reportsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        interviewId: z.string().uuid(),
        overallScore: z.number().int().min(0).max(100),
        technicalScore: z.number().int().min(0).max(100),
        communicationScore: z.number().int().min(0).max(100),
        strengths: z.array(z.string()),
        improvements: z.array(z.string()),
        detailedFeedback: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const interviewRows = await ctx.db
        .select({ id: interviews.id })
        .from(interviews)
        .where(
          and(
            eq(interviews.id, input.interviewId),
            eq(interviews.userId, ctx.session.user.id)
          )
        );

      if (interviewRows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      const rows = await ctx.db
        .insert(reports)
        .values({
          interviewId: input.interviewId,
          overallScore: input.overallScore,
          technicalScore: input.technicalScore,
          communicationScore: input.communicationScore,
          strengths: input.strengths,
          improvements: input.improvements,
          detailedFeedback: input.detailedFeedback,
        })
        .returning();

      return rows;
    }),

  getByInterviewId: protectedProcedure
    .input(z.object({ interviewId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(reports)
        .innerJoin(interviews, eq(reports.interviewId, interviews.id))
        .where(
          and(
            eq(reports.interviewId, input.interviewId),
            eq(interviews.userId, ctx.session.user.id)
          )
        );

      if (rows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      return rows.map((row) => row.reports);
    }),
});
