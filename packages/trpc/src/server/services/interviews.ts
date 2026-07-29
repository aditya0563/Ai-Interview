import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { DB, interviews, interviewMessages, interviewCodeSnapshots } from "@repo/database";
import { generateInterviewResponse } from "./ai";

interface ProcessInterviewAnswerParams {
  db: DB;
  userId: string;
  interviewId: string;
  message: string;
  code: string;
}

export const processInterviewAnswer = async ({
  db,
  userId,
  interviewId,
  message,
  code,
}: ProcessInterviewAnswerParams) => {
  // ─── Phase 1: Safe Write & Idempotency Lock ─────────────────────────────
  const interviewRole = await db.transaction(async (tx) => {
    // 1. Fetch the interview to ensure it exists and belongs to the user, with row-level lock
    const interviewRows = await tx.select().from(interviews).where(
      and(eq(interviews.id, interviewId), eq(interviews.userId, userId))
    ).for("update");

    if (interviewRows.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Resource not found",
      });
    }

    const interview = interviewRows[0]!;

    // 2. Idempotency Check: reject if currently processing
    if (interview.status === "processing") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Interview is already processing a submission",
      });
    }

    // 3. Insert the candidate's message
    await tx.insert(interviewMessages).values({
      interviewId,
      role: "user",
      content: message,
    });

    // 4. Insert the candidate's code snapshot
    await tx.insert(interviewCodeSnapshots).values({
      interviewId,
      code,
      language: "javascript",
    });

    // 5. Update status to processing
    await tx.update(interviews).set({
      status: "processing",
    }).where(eq(interviews.id, interviewId));

    return interview.jobRole;
  });

  // ─── Phase 2: External API & State Update ───────────────────────────────
  try {
    // Fetch the full message history to send to Gemini (limit 10 for token optimization)
    const recentMessages = await db.query.interviewMessages.findMany({
      where: eq(interviewMessages.interviewId, interviewId),
      orderBy: (msgs, { desc }) => [desc(msgs.createdAt)],
      limit: 10,
    });

    // Reverse to restore chronological order
    const chronologicalMessages = [...recentMessages].reverse();

    const transcript = chronologicalMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Generate AI Response using the jobRole we grabbed in Phase 1
    const aiText = await generateInterviewResponse(
      interviewRole,
      transcript,
      code
    );

    // AI Success: Insert message and revert status to active
    await db.transaction(async (tx) => {
      await tx.insert(interviewMessages).values({
        interviewId,
        role: "assistant",
        content: aiText,
      });

      await tx.update(interviews).set({
        status: "active",
      }).where(eq(interviews.id, interviewId));
    });

    // Fetch the final, updated interview state with relations for the frontend
    const updatedInterview = await db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
      with: {
        messages: true,
        snapshots: true,
      },
    });

    return {
      aiResponse: aiText,
      interview: updatedInterview!,
    };
  } catch (error) {
    // AI Failed: Update status to ai_failed so frontend can render a Retry button
    await db.update(interviews).set({
      status: "ai_failed",
    }).where(eq(interviews.id, interviewId));

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to generate AI response. Please try again.",
      cause: error,
    });
  }
};
