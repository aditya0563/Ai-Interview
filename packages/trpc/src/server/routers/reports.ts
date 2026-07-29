import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { reports, interviews } from "@repo/database";
import { protectedProcedure, router } from "../trpc";

export const reportsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        interviewId: z.string().cuid2(),
        overallScore: z.number().int().min(0).max(100),
        technicalScore: z.number().int().min(0).max(100),
        communicationScore: z.number().int().min(0).max(100),
        strengths: z.array(z.string().trim().max(1000)),
        improvements: z.array(z.string().trim().max(1000)),
        detailedFeedback: z.string().trim().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const interview = await ctx.db.query.interviews.findFirst({
        where: and(
          eq(interviews.id, input.interviewId),
          eq(interviews.userId, ctx.session.user.id)
        ),
      });

      if (!interview) {
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
    .input(z.object({ interviewId: z.string().cuid2() }))
    .query(async ({ ctx, input }) => {
      const interviewWithReports = await ctx.db.query.interviews.findFirst({
        where: and(
          eq(interviews.id, input.interviewId),
          eq(interviews.userId, ctx.session.user.id)
        ),
        with: {
          reports: true,
        },
      });

      if (!interviewWithReports || interviewWithReports.reports.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      return interviewWithReports.reports;
    }),
});
