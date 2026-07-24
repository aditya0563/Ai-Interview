import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { interviews } from "@repo/database";
import { publicProcedure, router } from "../trpc";
import { generateInterviewResponse } from "../services/ai";

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

  /**
   * Accepts the candidate's latest message and code snapshot, persists both,
   * calls Gemini to generate the next interviewer question, persists that too,
   * and returns the AI response text plus the updated interview row.
   */
  submitAnswer: publicProcedure
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
        .where(eq(interviews.id, input.interviewId));

      if (rows.length === 0) {
        throw new Error(`Interview not found: ${input.interviewId}`);
      }

      const interview = rows[0]!;

      // 2. Build the user message object
      const userMessage = { role: "user", content: input.message };

      // 3. Append the user message to the DB transcript
      await ctx.db
        .update(interviews)
        .set({
          transcript: sql`${interviews.transcript} || ${JSON.stringify([userMessage])}::jsonb`,
        })
        .where(eq(interviews.id, input.interviewId));

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
      const [updatedInterview] = await ctx.db
        .update(interviews)
        .set({
          transcript: sql`${interviews.transcript} || ${JSON.stringify([assistantMessage])}::jsonb`,
        })
        .where(eq(interviews.id, input.interviewId))
        .returning();

      return {
        aiResponse: aiText,
        interview: updatedInterview!,
      };
    }),
});
