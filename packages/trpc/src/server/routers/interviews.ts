import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { interviews, interviewMessages } from "@repo/database";
import { aiProcedure, protectedProcedure, router } from "../trpc";
import { processInterviewAnswer } from "../services/interviews";

export const interviewsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        jobRole: z.string().trim().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .insert(interviews)
        .values({
          userId: ctx.session.user.id,
          jobRole: input.jobRole,
        })
        .returning();
        
      return rows;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid2() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.query.interviews.findFirst({
        where: and(
          eq(interviews.id, input.id),
          eq(interviews.userId, ctx.session.user.id)
        ),
        with: {
          messages: true,
          snapshots: true,
        },
      });

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      return row;
    }),

  addTranscriptMessage: protectedProcedure
    .input(
      z.object({
        interviewId: z.string().cuid2(),
        message: z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string().trim().max(1000),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First ensure the interview belongs to the user
      const row = await ctx.db.query.interviews.findFirst({
        where: and(
          eq(interviews.id, input.interviewId),
          eq(interviews.userId, ctx.session.user.id)
        ),
      });

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      const rows = await ctx.db
        .insert(interviewMessages)
        .values({
          interviewId: input.interviewId,
          role: input.message.role,
          content: input.message.content,
        })
        .returning();

      return rows;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        interviewId: z.string().cuid2(),
        status: z.enum(["active", "completed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .update(interviews)
        .set({ status: input.status })
        .where(
          and(
            eq(interviews.id, input.interviewId),
            eq(interviews.userId, ctx.session.user.id)
          )
        )
        .returning();

      if (rows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      return rows;
    }),

  /**
   * Accepts the candidate's latest message and code snapshot, persists both,
   * calls Gemini to generate the next interviewer question, persists that too,
   * and returns the AI response text plus the updated interview row.
   */
  submitAnswer: aiProcedure
    .input(
      z.object({
        interviewId: z.string().cuid2(),
        message: z.string().trim().min(1, "Message cannot be empty").max(1000),
        code: z.string().trim().max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await processInterviewAnswer({
        db: ctx.db,
        userId: ctx.session.user.id,
        interviewId: input.interviewId,
        message: input.message,
        code: input.code,
      });
    }),
});
