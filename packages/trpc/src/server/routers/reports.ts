import { eq } from "drizzle-orm";
import { z } from "zod";
import { reports } from "@repo/database";
import { publicProcedure, router } from "../trpc";

export const reportsRouter = router({
  create: publicProcedure
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
    .mutation(({ ctx, input }) => {
      return ctx.db
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
    }),

  getByInterviewId: publicProcedure
    .input(z.object({ interviewId: z.string().uuid() }))
    .query(({ ctx, input }) => {
      return ctx.db
        .select()
        .from(reports)
        .where(eq(reports.interviewId, input.interviewId));
    }),
});
