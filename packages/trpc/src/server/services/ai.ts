import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Client (lazy-initialised so missing key only throws at call-time) ────────

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set. " +
        "Add it to apps/web/.env.local before using AI features."
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranscriptMessage {
  role: string;
  content: string;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Calls Gemini to generate a concise follow-up interviewer question based on
 * the live conversation transcript and the candidate's current code snapshot.
 *
 * @param jobRole    - The role being interviewed for (e.g. "Senior Frontend Engineer")
 * @param transcript - Full conversation history so far (user + assistant turns)
 * @param currentCode - The candidate's current code editor content
 * @returns           The interviewer's next response as a plain string
 */
export async function generateInterviewResponse(
  jobRole: string,
  transcript: TranscriptMessage[],
  currentCode: string
): Promise<string> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const formattedTranscript = transcript
    .map((m) => `${m.role === "assistant" ? "Interviewer" : "Candidate"}: ${m.content}`)
    .join("\n");

  const prompt = `You are a senior technical interviewer conducting a live coding interview for the role of "${jobRole}".

## Conversation so far
${formattedTranscript || "(No messages yet — this is the opening question.)"}

## Candidate's current code
\`\`\`typescript
${currentCode || "// (empty)"}
\`\`\`

## Your task
Review the conversation and the live code above. Generate a single, concise follow-up question or piece of feedback (2–4 sentences max). Stay in character as the interviewer:
- If the candidate asked a clarifying question, answer it directly and briefly.
- If the code has a bug or room for improvement, point it out as a guiding question, not a direct answer.
- If the solution looks correct, probe deeper (time/space complexity, edge cases, alternative approaches).
- Do NOT repeat information already covered. Do NOT include any preamble like "Sure!" or "Great question!".

Respond with ONLY the interviewer's next message.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}
