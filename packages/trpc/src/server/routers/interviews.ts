import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { interviews } from "@repo/database";
import { protectedProcedure, router } from "../trpc";
import { generateInterviewResponse } from "../services/ai";

export const interviewsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        jobRole: z.string().min(1),
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
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(interviews)
        .where(
          and(
            eq(interviews.id, input.id),
            eq(interviews.userId, ctx.session.user.id)
          )
        );

      if (rows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      return rows;
    }),

  addTranscriptMessage: protectedProcedure
    .input(
      z.object({
        interviewId: z.string().uuid(),
        message: z.object({
          role: z.string(),
          content: z.string(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .update(interviews)
        .set({
          transcript: sql`${interviews.transcript} || ${JSON.stringify([input.message])}::jsonb`,
        })
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

  updateStatus: protectedProcedure
    .input(
      z.object({
        interviewId: z.string().uuid(),
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
  submitAnswer: protectedProcedure
    .input(
      z.object({
        interviewId: z.string().uuid(),
        message: z.string().min(1, "Message cannot be empty"),
        code: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch the current interview row (for jobRole + existing transcript)
      const rows = await ctx.db
        .select()
        .from(interviews)
        .where(
          and(
            eq(interviews.id, input.interviewId),
            eq(interviews.userId, ctx.session.user.id)
          )
        );

      if (rows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      const interview = rows[0]!;

      // 2. Build the user message object
      const userMessage = { role: "user", content: input.message };

      // 3. Append the user message to the DB transcript
      const update1 = await ctx.db
        .update(interviews)
        .set({
          transcript: sql`${interviews.transcript} || ${JSON.stringify([userMessage])}::jsonb`,
        })
        .where(
          and(
            eq(interviews.id, input.interviewId),
            eq(interviews.userId, ctx.session.user.id)
          )
        )
        .returning();

      if (update1.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      // 4. Generate the AI follow-up using the full transcript (including the
      //    new user message) and the live code snapshot
      const updatedTranscript = [...(interview.transcript ?? []), userMessage];
      const aiText = await generateInterviewResponse(
        interview.jobRole,
        updatedTranscript,
        input.code
      );

      // 5. Build the assistant message object
      const assistantMessage = { role: "assistant", content: aiText };

      // 6. Append the AI message and return the final interview row
      const finalUpdate = await ctx.db
        .update(interviews)
        .set({
          transcript: sql`${interviews.transcript} || ${JSON.stringify([assistantMessage])}::jsonb`,
        })
        .where(
          and(
            eq(interviews.id, input.interviewId),
            eq(interviews.userId, ctx.session.user.id)
          )
        )
        .returning();

      if (finalUpdate.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      return {
        aiResponse: aiText,
        interview: finalUpdate[0]!,
      };
    }),
});
